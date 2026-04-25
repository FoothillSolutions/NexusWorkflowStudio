// ─── Workflow Generator ──────────────────────────────────────────────────────
// Core AI workflow generation logic: sends a prompt to the LLM, streams the
// response via SSE, incrementally parses the JSON, and pushes nodes/edges
// to the canvas in real-time.

import { toast } from "sonner";
import { useOpenCodeStore } from "../opencode";
import { useWorkflowStore } from "../workflow";
import { useSavedWorkflowsStore } from "../library";
import { AGENT_TOOLS } from "@/nodes/agent/constants";
import { validateWorkflowJson } from "@/lib/workflow-validation";
import {
  summarizeStructuralIssues,
  validateWorkflowStructure,
} from "@/lib/workflow-structure-validator";
import { WorkflowNodeType, type NodeType, type WorkflowNode, type WorkflowJSON } from "@/types/workflow";
import type { StoreGet, StoreSet } from "./types";
import { estimateTokens } from "./types";
import { buildSystemPrompt } from "./system-prompt";
import { buildEditUserMessage } from "./edit-message";
import { extractStreamedWorkflow, tryParseCompleteJSON } from "./streaming-parser";
import { fixEdgeHandles, type NodeBranchInfo } from "./edge-fixer";
import { parseSelectedModel } from "./model-utils";

/** Delay before clearing the temporary glow applied to newly streamed nodes. */
const NODE_GLOW_CLEAR_DELAY_MS = 450;

/** Delay before clearing the completion glow applied to edited nodes (Edit / Apply Suggestion). */
const EDIT_COMPLETION_GLOW_DURATION_MS = 1800;

/** Delay before dispatching auto-layout after generation completes. */
const AUTO_LAYOUT_DISPATCH_DELAY_MS = 100;

/** Delay between auto-layout and fit-view so the layout pass can settle first. */
const FIT_VIEW_DISPATCH_DELAY_MS = 500;

/** Number of recent assistant messages fetched when SSE streaming returns no text. */
const MESSAGE_FALLBACK_FETCH_LIMIT = 2;

/** Allow long-running ACP generations to complete even when the shared client uses a short default timeout. */
const WORKFLOW_GENERATION_TIMEOUT_MS = 5 * 60_000;

function extractTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function toNodeType(value: unknown): NodeType | null {
  return typeof value === "string" ? (value as NodeType) : null;
}

// ── Node / Edge readiness checks ─────────────────────────────────────────────

/**
 * Check whether a raw node object looks "complete enough" to render.
 * Requires id, position with both x/y, and data with type + label.
 * The last node in the array is likely still being streamed — we also
 * require `name` for it as a safety gate.
 */
function isNodeReady(raw: Record<string, unknown>, isLast: boolean): boolean {
  if (!raw.id) return false;
  const pos = raw.position as Record<string, unknown> | undefined;
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return false;
  const d = raw.data as Record<string, unknown> | undefined;
  if (!d || !d.type || !d.label) return false;
  return !isLast || !!d.name;
}

/** Check if an edge has all required fields. */
function isEdgeReady(raw: Record<string, unknown>): boolean {
  return !!(raw.id && raw.source && raw.target);
}

// ── Incremental canvas updater ───────────────────────────────────────────────

interface IncrementalContext {
  addedNodeIds: Set<string>;
  addedEdgeIds: Set<string>;
  pendingEdges: Array<Record<string, unknown>>;
  nodeDataSnapshots: Map<string, string>;
  set: StoreSet;
  get: StoreGet;
}

/** Push newly parsed nodes and edges incrementally to the canvas. */
function pushIncremental(
  parsed: { name?: string; nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> },
  ctx: IncrementalContext,
): void {
  const { addedNodeIds, addedEdgeIds, nodeDataSnapshots, set, get } = ctx;
  const wfStore = useWorkflowStore.getState();

  // Set workflow name once available
  if (parsed.name && wfStore.name !== parsed.name) {
    wfStore.setName(parsed.name);
  }

  // Build node type map for edge handle fixing
  const nodeTypeMap = new Map<string, NodeBranchInfo>();

  if (parsed.nodes && parsed.nodes.length > 0) {
    const brandNewNodes: WorkflowNode[] = [];
    const updatedNodes = new Map<string, Record<string, unknown>>();

    for (let i = 0; i < parsed.nodes.length; i++) {
      const rawNode = parsed.nodes[i];
      const nodeId = rawNode.id as string;
      const isLast = i === parsed.nodes.length - 1;

      if (!nodeId) continue;

      // Register in type map regardless of readiness
      const d = rawNode.data as Record<string, unknown> | undefined;
      const nodeType = toNodeType(d?.type);
      if (nodeType) {
        const branchInfo: NodeBranchInfo = {
          type: nodeType,
          branches: d?.branches as Array<{ label: string }> | undefined,
          options: d?.options as Array<{ label: string }> | undefined,
          multipleSelection: d?.multipleSelection as boolean | undefined,
          aiSuggestOptions: d?.aiSuggestOptions as boolean | undefined,
          spawnMode: d?.spawnMode as "fixed" | "dynamic" | undefined,
        };
        nodeTypeMap.set(nodeId, branchInfo);
      }

      if (!isNodeReady(rawNode, isLast)) continue;

      // Compute a snapshot to detect whether the data has changed
      const snapshot = JSON.stringify(rawNode.data);

      if (!addedNodeIds.has(nodeId)) {
        // ── Brand new node — add to canvas ──────────────────────
        const isStart = d?.type === WorkflowNodeType.Start;
        const node: WorkflowNode = {
          ...rawNode,
          type: rawNode.type as string ?? (d?.type as string),
          ...(isStart ? { deletable: false } : {}),
        } as unknown as WorkflowNode;

        brandNewNodes.push(node);
        addedNodeIds.add(nodeId);
        nodeDataSnapshots.set(nodeId, snapshot);
      } else {
        // ── Already on canvas — update if data grew ─────────────
        const prev = nodeDataSnapshots.get(nodeId);
        if (prev !== snapshot) {
          updatedNodes.set(nodeId, rawNode);
          nodeDataSnapshots.set(nodeId, snapshot);
        }
      }
    }

    // Apply brand-new nodes
    if (brandNewNodes.length > 0) {
      const existingNodes = useWorkflowStore.getState().nodes;
      const filtered = existingNodes.filter((n) => (
        !(n.data?.type === WorkflowNodeType.Start && brandNewNodes.some((nn) => nn.data.type === WorkflowNodeType.Start)) &&
        !(n.data?.type === WorkflowNodeType.End && brandNewNodes.some((nn) => nn.data.type === WorkflowNodeType.End)) &&
        !brandNewNodes.some((nn) => nn.id === n.id)
      ));
      useWorkflowStore.setState({ nodes: [...filtered, ...brandNewNodes] });
      for (const n of filtered) addedNodeIds.add(n.id);

      // Fit view to follow the growing workflow
      window.dispatchEvent(new CustomEvent("nexus:fit-view"));

      // Only the brand-new nodes get the glow
      const newNodeIds = brandNewNodes.map(n => n.id);
      set({ _glowingNodeIds: newNodeIds });

      // Remove the effect after a short time
      setTimeout(() => {
        // Only clear if these are still the glowing ones
        const current = get()._glowingNodeIds;
        if (current === newNodeIds) {
          set({ _glowingNodeIds: [] });
        }
      }, NODE_GLOW_CLEAR_DELAY_MS);
    }

    // Apply data updates to already-rendered nodes
    if (updatedNodes.size > 0) {
      const currentNodes = useWorkflowStore.getState().nodes;
      const patched = currentNodes.map(n => {
        const update = updatedNodes.get(n.id);
        if (!update) return n;
        return {
          ...n,
          data: { ...(update.data as Record<string, unknown>) },
        } as unknown as WorkflowNode;
      });
      useWorkflowStore.setState({ nodes: patched });
    }
  }

  // ── Process edges (new + previously pending) ────────────────────
  const allCandidateEdges = [
    ...ctx.pendingEdges,
    ...(parsed.edges?.filter(e => {
      const eid = e.id as string;
      return eid && !addedEdgeIds.has(eid) && isEdgeReady(e);
    }) ?? []),
  ];

  // Deduplicate by id
  const seenEdgeIds = new Set<string>();
  const uniqueEdges: Array<Record<string, unknown>> = [];
  for (const e of allCandidateEdges) {
    const eid = e.id as string;
    if (!eid || seenEdgeIds.has(eid) || addedEdgeIds.has(eid)) continue;
    seenEdgeIds.add(eid);
    uniqueEdges.push(e);
  }

  const readyEdges: Array<Record<string, unknown>> = [];
  const stillPending: Array<Record<string, unknown>> = [];

  for (const edge of uniqueEdges) {
    const sourceId = edge.source as string;
    const targetId = edge.target as string;
    if (addedNodeIds.has(sourceId) && addedNodeIds.has(targetId)) {
      readyEdges.push(edge);
    } else {
      stillPending.push(edge);
    }
  }

  ctx.pendingEdges = stillPending;

  if (readyEdges.length > 0) {
    const fixedEdges = fixEdgeHandles(readyEdges, nodeTypeMap);
    const fixedEdgeIds = new Set(fixedEdges.map((e) => e.id));
    const existingEdges = useWorkflowStore
      .getState()
      .edges.filter((e) => !fixedEdgeIds.has(e.id));
    useWorkflowStore.setState({ edges: [...existingEdges, ...fixedEdges] });
    for (const e of fixedEdges) addedEdgeIds.add(e.id);
  }

  set({
    _addedNodeIds: addedNodeIds,
    _addedEdgeIds: addedEdgeIds,
    _pendingEdges: stillPending,
  });
}

// ── Main generate function ───────────────────────────────────────────────────

/** Run the AI workflow generation: send prompt, stream response, update canvas. */
export async function generate(set: StoreSet, get: StoreGet): Promise<void> {
  const { prompt, selectedModel, mode } = get();
  if (!prompt.trim()) {
    set({
      error: mode === "edit"
        ? "Please describe the change you want to make."
        : "Please enter a description of the workflow you want to generate.",
      status: "error",
    });
    return;
  }

  const client = useOpenCodeStore.getState().client;
  if (!client) {
    set({
      error: "Not connected to an AI endpoint. Connect to the ACP bridge or an OpenCode server first.",
      status: "error",
    });
    return;
  }

  // Cancel any in-progress generation
  get()._abortController?.abort();

  const abortController = new AbortController();

  // Capture the current workflow snapshot BEFORE any canvas mutation. In Edit
  // mode this is embedded in the user message; in Generate mode it is unused.
  let currentJson: WorkflowJSON | null = null;
  // Per-node data snapshots captured in Edit mode so we can highlight which
  // nodes were actually changed once the AI completes.
  let editBeforeSnapshots: Map<string, string> | null = null;
  if (mode === "edit") {
    currentJson = useWorkflowStore.getState().getWorkflowJSON();
    editBeforeSnapshots = new Map<string, string>();
    for (const n of currentJson.nodes) {
      editBeforeSnapshots.set(n.id, JSON.stringify(n.data));
    }
  } else {
    // Clear the canvas completely before starting a new generation
    useSavedWorkflowsStore.getState().clearActiveId();
    useWorkflowStore.getState().reset();
    useWorkflowStore.setState({ nodes: [], edges: [], name: "Untitled Workflow", sidebarOpen: false });
  }

  // Pause undo/redo history so incremental adds don't flood the stack
  useWorkflowStore.temporal.getState().pause();

  const parsedModel = parseSelectedModel(selectedModel);
  if (!parsedModel) {
    useWorkflowStore.temporal.getState().resume();
    set({
      error: "Please select a model before generating a workflow.",
      status: "error",
      _abortController: null,
    });
    return;
  }

  // Ensure session
  let sid = get().sessionId;
  if (!sid) {
    set({ status: "creating-session", error: null, _abortController: abortController });
    try {
      const session = await client.sessions.create(
        { title: "Nexus Workflow Generator" },
        { signal: abortController.signal, timeout: WORKFLOW_GENERATION_TIMEOUT_MS },
      );
      sid = session.id;
      set({ sessionId: sid });
    } catch (err) {
      if (abortController.signal.aborted) {
        useWorkflowStore.temporal.getState().resume();
        set({ status: "idle", error: null, _abortController: null });
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to create session";
      useWorkflowStore.temporal.getState().resume();
      set({ error: msg, status: "error", _abortController: null });
      return;
    }
  }

  const ctx: IncrementalContext = {
    addedNodeIds: new Set<string>(),
    addedEdgeIds: new Set<string>(),
    pendingEdges: [],
    nodeDataSnapshots: new Map<string, string>(),
    set,
    get,
  };

  set({
    status: "streaming",
    streamedText: "",
    parsedNodeCount: 0,
    parsedEdgeCount: 0,
    tokenCount: 0,
    error: null,
    _abortController: abortController,
    _addedNodeIds: ctx.addedNodeIds,
    _addedEdgeIds: ctx.addedEdgeIds,
    _pendingEdges: [],
  });

  const { providerId, modelId } = parsedModel;

  try {
    const { useProjectContext, projectContext } = get();

    // Collect available models from the opencode store
    const modelGroups = useOpenCodeStore.getState().modelGroups;
    const availableModels = modelGroups.flatMap((g) => g.models.map((m) => m.value));

    // Collect available tools
    const availableTools: string[] = [...AGENT_TOOLS];

    const systemPrompt = buildSystemPrompt({
      projectContext: useProjectContext ? projectContext : null,
      availableModels,
      availableTools,
      mode,
    });

    const userText = mode === "edit" && currentJson
      ? buildEditUserMessage(currentJson, prompt)
      : `Output a WorkflowJSON object for this workflow. Do NOT plan, do NOT explain, do NOT use tools. Start your response with { immediately.\n\nWorkflow description: ${prompt}`;

    // Attach the event stream before sending so fast ACP backends do not emit
    // their earliest deltas before the browser has started reading the SSE
    // response. The async generator only starts on first next(), so explicitly
    // prime it here before issuing the prompt request.
    const eventStream = client.events.subscribe({ signal: abortController.signal });
    let nextEvent = eventStream.next();

    await client.messages.sendAsync(
      sid,
      {
        parts: [{ type: "text", text: userText }],
        ...(providerId && modelId
          ? { model: { providerID: providerId, modelID: modelId } }
          : {}),
        system: systemPrompt,
      },
      {
        signal: abortController.signal,
        timeout: WORKFLOW_GENERATION_TIMEOUT_MS,
      },
    );

    let fullText = "";
    let lastParsedNodeCount = 0;
    let lastParsedEdgeCount = 0;

    // Per-text-part cumulative state. OpenCode native server streams via
    // `message.part.updated` events (cumulative `Part` per update); the
    // ACP/Claude Code bridge streams via `message.part.delta` events
    // (incremental string fragments). Support BOTH: deltas append, updated
    // events overwrite. `fullText` is the concatenation of all entries in
    // insertion order so multi-part assistant messages render correctly.
    const partTexts = new Map<string, string>();
    const recomputeFullText = () => {
      let combined = "";
      for (const t of partTexts.values()) combined += t;
      fullText = combined;
    };

    /** Run a parse and push results to the canvas. */
    const doParse = () => {
      const parsed = extractStreamedWorkflow(fullText);

      const nodeCount = parsed.nodes.length;
      const edgeCount = parsed.edges.length;

      // Only push if we actually have something new
      if (nodeCount > lastParsedNodeCount || edgeCount > lastParsedEdgeCount || (parsed.name && nodeCount === 0)) {
        pushIncremental(parsed, ctx);
      }

      lastParsedNodeCount = nodeCount;
      lastParsedEdgeCount = edgeCount;

      set({ parsedNodeCount: nodeCount, parsedEdgeCount: edgeCount });
    };

    set({
      streamedText: fullText,
      tokenCount: estimateTokens(fullText),
    });

    while (true) {
      const { value: event, done } = await nextEvent;
      if (done) break;

      if (abortController.signal.aborted) {
        break;
      }

      if (event.type === "message.part.delta") {
        const props = event.properties as { sessionID: string; messageID: string; partID: string; field: string; delta: string };
        if (props.sessionID !== sid || props.field !== "text") {
          nextEvent = eventStream.next();
          continue;
        }

        partTexts.set(props.partID, (partTexts.get(props.partID) ?? "") + props.delta);
        recomputeFullText();
        set({
          streamedText: fullText,
          tokenCount: estimateTokens(fullText),
        });
        doParse();
      } else if (event.type === "message.part.updated") {
        const props = event.properties as {
          part: { id: string; sessionID: string; type: string; text?: string };
        };
        const part = props.part;
        if (part.sessionID !== sid || part.type !== "text" || typeof part.text !== "string") {
          nextEvent = eventStream.next();
          continue;
        }

        partTexts.set(part.id, part.text);
        recomputeFullText();
        set({
          streamedText: fullText,
          tokenCount: estimateTokens(fullText),
        });
        doParse();
      } else if (event.type === "session.error") {
        const props = event.properties as {
          sessionID?: string;
          error?: { data?: { message?: string } };
        };
        if (props.sessionID === sid) {
          useWorkflowStore.temporal.getState().resume();
          await eventStream.return?.(undefined).catch(() => {});
          set({
            error: props.error?.data?.message ?? "Generation failed",
            status: "error",
            _abortController: null,
          });
          return;
        }
      } else if (event.type === "session.idle") {
        const props = event.properties as { sessionID: string };
        if (props.sessionID === sid) {
          break;
        }
      }

      nextEvent = eventStream.next();
    }

    await eventStream.return?.(undefined).catch(() => {});

    if (abortController.signal.aborted) {
      try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }
      set({ status: "idle", error: null, _abortController: null });
      return;
    }

    // Reconcile against the final assistant message so we recover from any
    // missed or partial deltas while preserving the streamed canvas updates.
    let cleanedForFallbackCheck = fullText.trim();
    if (cleanedForFallbackCheck.startsWith("```")) {
      cleanedForFallbackCheck = cleanedForFallbackCheck
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }

    if (!cleanedForFallbackCheck || !tryParseCompleteJSON(cleanedForFallbackCheck)) {
      const messages = await client.messages.list(sid, MESSAGE_FALLBACK_FETCH_LIMIT);
      const assistantMsg = messages.find((m) => m.info.role === "assistant");
      if (assistantMsg) {
        const finalText = extractTextFromParts(assistantMsg.parts as Array<{ type: string; text?: string }>);
        if (finalText.trim()) {
          fullText = finalText;
          set({ streamedText: fullText, tokenCount: estimateTokens(fullText) });
        }
      }
    }

    doParse();

    // ── Final parse and load any remaining items ──────────────────
    if (fullText.trim()) {
      let cleanText = fullText.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      // One final streaming extract to catch any remaining objects
      const finalStreamed = extractStreamedWorkflow(cleanText);
      pushIncremental(finalStreamed, ctx);

      // Force flush any remaining pending edges
      if (ctx.pendingEdges.length > 0) {
        const nodeTypeMap = new Map<string, NodeBranchInfo>();
        for (const n of finalStreamed.nodes) {
          const d = n.data as Record<string, unknown> | undefined;
          const nodeType = toNodeType(d?.type) ?? toNodeType(n.type);
          if (n.id) {
            if (!nodeType) continue;
            const branchInfo: NodeBranchInfo = {
              type: nodeType,
              branches: d?.branches as Array<{ label: string }> | undefined,
              options: d?.options as Array<{ label: string }> | undefined,
              multipleSelection: d?.multipleSelection as boolean | undefined,
              aiSuggestOptions: d?.aiSuggestOptions as boolean | undefined,
              spawnMode: d?.spawnMode as "fixed" | "dynamic" | undefined,
            };
            nodeTypeMap.set(n.id as string, branchInfo);
          }
        }
        const fixedEdges = fixEdgeHandles(ctx.pendingEdges, nodeTypeMap);
        const existingEdges = useWorkflowStore.getState().edges;
        useWorkflowStore.setState({ edges: [...existingEdges, ...fixedEdges] });
        ctx.pendingEdges = [];
      }

      // Validate the complete JSON if possible (non-blocking — we already have nodes on canvas)
      const fullParsed = tryParseCompleteJSON(cleanText);
      if (fullParsed) {
        const result = validateWorkflowJson(fullParsed);
        if (!result.success) {
          console.warn("Generated workflow has validation issues:", result.error.message);
          // Don't fail — nodes are already on canvas, just warn
        } else if (mode === "edit") {
          // Edit mode: atomically replace the canvas with the fully validated
          // workflow so any half-streamed intermediate state is discarded.
          useWorkflowStore.getState().loadWorkflow(result.data as WorkflowJSON);
        }
      }

      // Resume undo/redo history
      useWorkflowStore.temporal.getState().resume();

      // Auto-layout then fit view
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("nexus:auto-layout"));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("nexus:fit-view"));
        }, FIT_VIEW_DISPATCH_DELAY_MS);
      }, AUTO_LAYOUT_DISPATCH_DELAY_MS);

      const finalNodes = useWorkflowStore.getState().nodes;
      const finalEdges = useWorkflowStore.getState().edges;

      // Structural validation — warn when the generated/edited workflow lacks
      // a valid start→end path or leaves flow nodes orphan. Non-blocking: the
      // canvas already reflects the AI output, but the user should know.
      try {
        const finalWorkflow = useWorkflowStore.getState().getWorkflowJSON();
        const structuralIssues = validateWorkflowStructure(finalWorkflow);
        const errors = structuralIssues.filter((i) => i.severity === "error");
        if (errors.length > 0) {
          console.warn("AI-generated workflow has issues:", structuralIssues);
          const bullets = errors.slice(0, 3).map((e) => `• ${e.message}`).join("\n");
          toast.warning(
            `Workflow may be incomplete: ${summarizeStructuralIssues(structuralIssues)}`,
            { description: bullets, duration: 8000 },
          );
        }
      } catch { /* validator must never crash generation */ }

      // Edit-mode completion glow — highlight every node the AI actually added
      // or modified, so the user can visually see what changed on the canvas.
      const completionGlowIds: string[] = [];
      if (mode === "edit" && editBeforeSnapshots) {
        for (const n of finalNodes) {
          const snapshot = JSON.stringify(n.data);
          const before = editBeforeSnapshots.get(n.id);
          if (before === undefined || before !== snapshot) {
            completionGlowIds.push(n.id);
          }
        }
      }

      set({
        status: "done",
        _abortController: null,
        _glowingNodeIds: completionGlowIds,
        parsedNodeCount: finalNodes.length,
        parsedEdgeCount: finalEdges.length,
      });

      if (completionGlowIds.length > 0) {
        setTimeout(() => {
          if (get()._glowingNodeIds === completionGlowIds) {
            set({ _glowingNodeIds: [] });
          }
        }, EDIT_COMPLETION_GLOW_DURATION_MS);
      }
    } else {
      set({ error: "No response received from the AI model.", status: "error", _abortController: null });
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }
      set({ status: "idle", error: null, _abortController: null });
      return;
    }
    try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message : "Generation failed";
    set({ error: msg, status: "error", _abortController: null });
  }
}


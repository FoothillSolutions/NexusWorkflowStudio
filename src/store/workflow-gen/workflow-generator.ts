// ─── Workflow Generator ──────────────────────────────────────────────────────
// Core AI workflow generation logic: sends a prompt to the LLM, streams the
// response via SSE, incrementally parses the JSON, and pushes nodes/edges
// to the canvas in real-time.

import { useOpenCodeStore } from "../opencode-store";
import { useWorkflowStore } from "../workflow-store";
import { AGENT_TOOLS } from "@/nodes/agent/constants";
import { workflowJsonSchema } from "@/lib/workflow-schema";
import type { WorkflowNode } from "@/types/workflow";
import type { StoreGet, StoreSet } from "./types";
import { estimateTokens } from "./types";
import { buildSystemPrompt } from "./system-prompt";
import { extractStreamedWorkflow, tryParseCompleteJSON } from "./streaming-parser";
import { fixEdgeHandles, type NodeBranchInfo } from "./edge-fixer";

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
  if (isLast && !d.name) return false;
  return true;
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
      if (d?.type) {
        nodeTypeMap.set(nodeId, {
          type: (d.type as string) ?? "",
          branches: d.branches as Array<{ label: string }> | undefined,
          options: d.options as Array<{ label: string }> | undefined,
          multipleSelection: d.multipleSelection as boolean | undefined,
          aiSuggestOptions: d.aiSuggestOptions as boolean | undefined,
        });
      }

      if (!isNodeReady(rawNode, isLast)) continue;

      // Compute a snapshot to detect whether the data has changed
      const snapshot = JSON.stringify(rawNode.data);

      if (!addedNodeIds.has(nodeId)) {
        // ── Brand new node — add to canvas ──────────────────────
        const isStart = d?.type === "start";
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
      const filtered = existingNodes.filter(n => {
        if (n.data?.type === "start" && brandNewNodes.some(nn => (nn.data as Record<string, unknown>)?.type === "start")) return false;
        if (n.data?.type === "end" && brandNewNodes.some(nn => (nn.data as Record<string, unknown>)?.type === "end")) return false;
        if (brandNewNodes.some(nn => nn.id === n.id)) return false;
        return true;
      });
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
      }, 450);
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
    const existingEdges = useWorkflowStore.getState().edges;
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
  const { prompt, selectedModel } = get();
  if (!prompt.trim()) {
    set({ error: "Please enter a description of the workflow you want to generate.", status: "error" });
    return;
  }

  const client = useOpenCodeStore.getState().client;
  if (!client) {
    set({ error: "Not connected to OpenCode server. Please connect first.", status: "error" });
    return;
  }

  // Cancel any in-progress generation
  get()._abortController?.abort();

  // Clear the canvas completely before starting a new generation
  useWorkflowStore.getState().reset();
  useWorkflowStore.setState({ nodes: [], edges: [], name: "Untitled Workflow", sidebarOpen: false });

  // Pause undo/redo history so incremental adds don't flood the stack
  useWorkflowStore.temporal.getState().pause();

  // Ensure session
  let sid = get().sessionId;
  if (!sid) {
    set({ status: "creating-session", error: null });
    try {
      const session = await client.sessions.create({ title: "Nexus Workflow Generator" });
      sid = session.id;
      set({ sessionId: sid });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      useWorkflowStore.temporal.getState().resume();
      set({ error: msg, status: "error" });
      return;
    }
  }

  const abortController = new AbortController();
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

  // Parse selected model
  const slashIdx = selectedModel.indexOf("/");
  const providerId = slashIdx > 0 ? selectedModel.slice(0, slashIdx) : "";
  const modelId = slashIdx > 0 ? selectedModel.slice(slashIdx + 1) : selectedModel;

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
    });

    // Send the message
    await client.messages.sendAsync(
      sid,
      {
        parts: [{ type: "text", text: `Output a WorkflowJSON object for this workflow. Do NOT plan, do NOT explain, do NOT use tools. Start your response with { immediately.\n\nWorkflow description: ${prompt}` }],
        ...(providerId && modelId
          ? { model: { providerID: providerId, modelID: modelId } }
          : {}),
        system: systemPrompt,
      },
      { signal: abortController.signal },
    );

    // Stream SSE events with rAF-gated parse+push
    let fullText = "";
    let lastParsedNodeCount = 0;
    let lastParsedEdgeCount = 0;
    let rafPending = false;
    let lastParseTime = 0;
    const MIN_PARSE_GAP_MS = 80;

    /** Run an incremental parse and push results to canvas. */
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

    /** Schedule a parse on the next animation frame, respecting minimum gap. */
    const scheduleRafParse = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const now = performance.now();
        if (now - lastParseTime < MIN_PARSE_GAP_MS) {
          // Too soon since last parse — schedule a delayed follow-up
          setTimeout(() => {
            lastParseTime = performance.now();
            doParse();
          }, MIN_PARSE_GAP_MS - (now - lastParseTime));
        } else {
          lastParseTime = now;
          doParse();
        }
      });
    };

    for await (const event of client.events.subscribe({ signal: abortController.signal })) {
      if (abortController.signal.aborted) break;

      if (event.type === "message.part.delta") {
        const props = event.properties as { sessionID: string; field: string; delta: string };
        if (props.sessionID === sid && props.field === "text") {
          fullText += props.delta;

          // Always update raw counters immediately
          set({
            streamedText: fullText,
            tokenCount: estimateTokens(fullText),
          });

          // rAF-gated parse — ties to browser paint cycle for smooth updates
          scheduleRafParse();
        }
      } else if (event.type === "session.idle") {
        const props = event.properties as { sessionID: string };
        if (props.sessionID === sid) break;
      } else if (event.type === "session.error") {
        const props = event.properties as {
          sessionID?: string;
          error?: { name: string; data?: { message?: string } };
        };
        if (props.sessionID === sid) {
          useWorkflowStore.temporal.getState().resume();
          set({ error: props.error?.data?.message ?? "Generation failed", status: "error" });
          return;
        }
      }
    }

    // Flush any pending parse
    doParse();

    // If streaming produced nothing, fall back to fetching the last message
    if (!fullText.trim()) {
      const messages = await client.messages.list(sid, 2);
      const assistantMsg = messages.find((m) => m.info.role === "assistant");
      if (assistantMsg) {
        const parts = assistantMsg.parts as Array<{ type: string; text?: string }>;
        fullText = parts
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text!)
          .join("");
        set({ streamedText: fullText, tokenCount: estimateTokens(fullText) });
      }
    }

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
          if (n.id) {
            nodeTypeMap.set(n.id as string, {
              type: (d?.type as string) ?? (n.type as string) ?? "",
              branches: d?.branches as Array<{ label: string }> | undefined,
              options: d?.options as Array<{ label: string }> | undefined,
              multipleSelection: d?.multipleSelection as boolean | undefined,
              aiSuggestOptions: d?.aiSuggestOptions as boolean | undefined,
            });
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
        const result = workflowJsonSchema.safeParse(fullParsed);
        if (!result.success) {
          console.warn("Generated workflow has validation issues:", result.error.message);
          // Don't fail — nodes are already on canvas, just warn
        }
      }

      // Resume undo/redo history
      useWorkflowStore.temporal.getState().resume();

      // Auto-layout then fit view
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("nexus:auto-layout"));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("nexus:fit-view"));
        }, 500);
      }, 100);

      const finalNodes = useWorkflowStore.getState().nodes;
      const finalEdges = useWorkflowStore.getState().edges;

      set({
        status: "done",
        _glowingNodeIds: [],
        parsedNodeCount: finalNodes.length,
        parsedEdgeCount: finalEdges.length,
      });
    } else {
      set({ error: "No response received from the AI model.", status: "error" });
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }
      set({ status: "idle", _abortController: null });
      return;
    }
    try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message : "Generation failed";
    set({ error: msg, status: "error", _abortController: null });
  }
}


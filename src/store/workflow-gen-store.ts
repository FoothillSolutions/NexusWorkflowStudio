// ─── AI Workflow Generation Store ────────────────────────────────────────────
// Manages sessions for AI-powered workflow generation from natural language.
// Sends a system prompt with the full node catalogue + schema to an LLM,
// streams back a WorkflowJSON, incrementally parses it, and loads it onto
// the canvas in real-time.

import { create } from "zustand";
import { useOpenCodeStore } from "./opencode-store";
import { useWorkflowStore } from "./workflow-store";
import { NODE_REGISTRY } from "@/lib/node-registry";
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { workflowJsonSchema } from "@/lib/workflow-schema";

// ── Types ────────────────────────────────────────────────────────────────────

export type WorkflowGenStatus =
  | "idle"
  | "creating-session"
  | "streaming"
  | "done"
  | "error";

interface WorkflowGenState {
  /** Whether the dialog is open */
  open: boolean;
  /** Current generation status */
  status: WorkflowGenStatus;
  /** The user's natural-language prompt */
  prompt: string;
  /** Selected model (providerId/modelId) */
  selectedModel: string;
  /** Streamed raw text so far */
  streamedText: string;
  /** Number of nodes parsed so far (for progress display) */
  parsedNodeCount: number;
  /** Number of edges parsed so far */
  parsedEdgeCount: number;
  /** Estimated token count */
  tokenCount: number;
  /** Error message if status is "error" */
  error: string | null;
  /** The active OpenCode session ID */
  sessionId: string | null;
  /** AbortController for the SSE stream */
  _abortController: AbortController | null;

  // Actions
  setOpen: (open: boolean) => void;
  setPrompt: (prompt: string) => void;
  setSelectedModel: (model: string) => void;
  generate: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  disposeSession: () => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Build the catalogue of available node types for the system prompt. */
function buildNodeCatalogue(): string {
  const lines: string[] = [];
  for (const [type, entry] of Object.entries(NODE_REGISTRY)) {
    const defaults = entry.defaultData();
    // Strip out non-serializable / internal fields
    const { type: _t, label: _l, name: _n, ...dataFields } = defaults as Record<string, unknown>;
    const fieldList = Object.keys(dataFields).length > 0
      ? `  Data fields: ${JSON.stringify(dataFields, null, 2).split("\n").join("\n  ")}`
      : "  No additional data fields.";

    lines.push(`### ${type}
- Display name: ${entry.description}
- Category: ${entry.category}
${fieldList}
`);
  }
  return lines.join("\n");
}

/** Build the system prompt that instructs the LLM how to generate workflows. */
function buildSystemPrompt(): string {
  return `You are a JSON generator. You output ONLY raw JSON. No planning. No thinking. No explanation. No tool calls. No code fences. No markdown. Just a single JSON object.

ABSOLUTE RULES — VIOLATING ANY OF THESE IS A FAILURE:
1. Output ONLY the JSON object. Start with { and end with }. Nothing before, nothing after.
2. Do NOT plan. Do NOT think step-by-step. Do NOT explain your reasoning. Do NOT describe what you will do.
3. Do NOT use code fences (\`\`\`). Do NOT write any markdown.
4. Do NOT use any tools. Do NOT read any files. Do NOT search anything. Just output JSON.
5. The output must be valid JSON parseable by JSON.parse().

You generate workflow JSON for Nexus Workflow Studio.

## WorkflowJSON Schema
{"name": string, "nodes": [{"id": string, "type": NodeType, "position": {"x": number, "y": number}, "data": NodeData}], "edges": [{"id": string, "source": string, "target": string, "sourceHandle"?: string, "targetHandle"?: string}], "ui": {"sidebarOpen": true, "minimapVisible": true, "viewport": {"x": 0, "y": 0, "zoom": 1}}}

## Node Rules
- Include exactly ONE "start" node and exactly ONE "end" node. Multiple start or end nodes are NOT allowed.
- Node IDs: "<type>-<random8chars>" (e.g. "agent-xK9mPq2w")
- data.type MUST match the node type field
- data.name MUST equal the node id
- POSITION RULES (these are critical — the layout is NOT auto-corrected):
  - Start node at x:80, y:300.
  - Flow left-to-right. Each subsequent column of nodes is ~300px further right.
  - Nodes in a straight sequential chain share the same y value.
  - BRANCHING: when an if-else or switch fans out, the branching node stays on the main y line.
    The TRUE / first-branch target MUST have a SMALLER y (higher on screen) than the FALSE / later-branch targets.
    Space branch targets ~200px apart vertically, centered around the branching node's y.
    Example: if-else at y:300 → true-target at y:200, false-target at y:400.
    Example: switch at y:300 with 3 branches → targets at y:100, y:300, y:500.
  - When branches merge back (e.g. both branches → end), place the merge target at the branching node's y.
  - End node should be at the rightmost column, same y as start.

## Edge Rules  
- Edge IDs: "e-<sourceId>-<targetId>"
- Normal flow: sourceHandle: "output", targetHandle: "input"
- Skill→Agent: targetHandle: "skills" (skill nodes can ONLY connect to agent nodes)
- Document→Agent: targetHandle: "docs" (document nodes can ONLY connect to agent nodes)

CRITICAL — If-else node edges:
- If-else nodes have exactly 2 branches. The sourceHandle IDs are ALWAYS "true" for the first branch and "false" for the second branch.
- You MUST create one edge per branch from the if-else node using these exact sourceHandle values.
- The "true" branch target must be positioned ABOVE the "false" branch target (lower y value).
- Example: if-else node "if-else-abc" at y:300 connecting to "agent-yes" at y:200 (first/true branch) and "agent-no" at y:400 (second/false branch):
  {"id":"e-if-else-abc-agent-yes","source":"if-else-abc","target":"agent-yes","sourceHandle":"true","targetHandle":"input"}
  {"id":"e-if-else-abc-agent-no","source":"if-else-abc","target":"agent-no","sourceHandle":"false","targetHandle":"input"}

CRITICAL — Switch node edges:
- Switch node sourceHandle IDs are the branch LABEL text (e.g. "Case 1", "default").
- You MUST create one edge per branch using the exact branch label as the sourceHandle.
- Branch targets must be stacked top-to-bottom matching branch order (first branch = smallest y, last branch = largest y).
- Example: switch node "switch-abc" at y:300 with branches labeled "Case 1", "Case 2", "default":
  {"id":"e-switch-abc-agent-a","source":"switch-abc","target":"agent-a","sourceHandle":"Case 1","targetHandle":"input"}  (agent-a at y:120)
  {"id":"e-switch-abc-agent-b","source":"switch-abc","target":"agent-b","sourceHandle":"Case 2","targetHandle":"input"}  (agent-b at y:300)
  {"id":"e-switch-abc-end-xyz","source":"switch-abc","target":"end-xyz","sourceHandle":"default","targetHandle":"input"}  (end-xyz at y:480)

Every branch MUST have an outgoing edge. Do NOT leave any branch unconnected.

## Available Node Types

${buildNodeCatalogue()}

## Node Data Templates

start: {"type":"start","label":"Start","name":"<id>"}
end: {"type":"end","label":"End","name":"<id>"}
agent: {"type":"agent","label":"<label>","name":"<id>","description":"<desc>","promptText":"<prompt>","detectedVariables":[],"model":"inherit","memory":"default","temperature":0,"color":"#5f27cd","disabledTools":[],"parameterMappings":[],"variableMappings":{}}
prompt: {"type":"prompt","label":"<label>","name":"<id>","promptText":"<text>","detectedVariables":[]}
skill: {"type":"skill","label":"<label>","name":"<id>","skillName":"<name>","projectName":"","description":"<desc>","promptText":"<instructions>","detectedVariables":[],"metadata":[]}
document: {"type":"document","label":"<label>","name":"<id>","docName":"<name>","contentMode":"inline","fileExtension":"md","contentText":"<content>","linkedFileName":"","linkedFileContent":"","description":"<desc>"}
mcp-tool: {"type":"mcp-tool","label":"<label>","name":"<id>","toolName":"<name>","paramsText":""}
if-else: {"type":"if-else","label":"<label>","name":"<id>","evaluationTarget":"<target>","branches":[{"label":"If <cond>","condition":"<cond>"},{"label":"Else","condition":"else"}]}
switch: {"type":"switch","label":"<label>","name":"<id>","evaluationTarget":"<target>","branches":[{"label":"<case>","condition":"<cond>"}]}
ask-user: {"type":"ask-user","label":"<label>","name":"<id>","questionText":"<question>","multipleSelection":false,"aiSuggestOptions":false,"options":[{"label":"<opt>","description":"<desc>"}]}
sub-workflow: {"type":"sub-workflow","label":"<label>","name":"<id>","mode":"same-context","subNodes":[],"subEdges":[],"nodeCount":0,"description":"","model":"inherit","memory":"default","temperature":0,"color":"#a855f7","disabledTools":[]}

Generate meaningful labels, descriptions, and promptText content. Make it production-ready. NOW OUTPUT ONLY JSON.`;
}

/**
 * Attempt to parse a (possibly incomplete) JSON string to extract the
 * full WorkflowJSON. Returns null if the JSON is not yet complete.
 */
function tryParseWorkflowJSON(text: string): {
  name?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  ui?: Record<string, unknown>;
} | null {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Not yet complete — try to auto-close
  }

  // Try to repair incomplete JSON by closing open brackets/braces
  let repaired = text.trim();
  // Remove trailing comma
  repaired = repaired.replace(/,\s*$/, "");

  // Count open brackets/braces
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of repaired) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }

  // Close any open strings (heuristic)
  if (inString) repaired += '"';

  // Close open brackets then braces
  while (brackets > 0) { repaired += "]"; brackets--; }
  while (braces > 0) { repaired += "}"; braces--; }

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowGenStore = create<WorkflowGenState>((set, get) => ({
  open: false,
  status: "idle",
  prompt: "",
  selectedModel: "",
  streamedText: "",
  parsedNodeCount: 0,
  parsedEdgeCount: 0,
  tokenCount: 0,
  error: null,
  sessionId: null,
  _abortController: null,

  setOpen: (open) => {
    if (!open) {
      // Cancel if closing while streaming
      const { status, _abortController } = get();
      if (status === "streaming" || status === "creating-session") {
        _abortController?.abort();
      }
    }
    set({ open });
  },

  setPrompt: (prompt) => set({ prompt }),
  setSelectedModel: (model) => set({ selectedModel: model }),

  generate: async () => {
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
        set({ error: msg, status: "error" });
        return;
      }
    }

    const abortController = new AbortController();
    set({
      status: "streaming",
      streamedText: "",
      parsedNodeCount: 0,
      parsedEdgeCount: 0,
      tokenCount: 0,
      error: null,
      _abortController: abortController,
    });

    // Parse selected model
    const slashIdx = selectedModel.indexOf("/");
    const providerId = slashIdx > 0 ? selectedModel.slice(0, slashIdx) : "";
    const modelId = slashIdx > 0 ? selectedModel.slice(slashIdx + 1) : selectedModel;

    try {
      const systemPrompt = buildSystemPrompt();

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

      // Stream SSE events
      let fullText = "";
      let lastParsedNodeCount = 0;
      let lastParsedEdgeCount = 0;

      for await (const event of client.events.subscribe({ signal: abortController.signal })) {
        if (abortController.signal.aborted) break;

        if (event.type === "message.part.delta") {
          const props = event.properties as { sessionID: string; field: string; delta: string };
          if (props.sessionID === sid && props.field === "text") {
            fullText += props.delta;
            const tokens = estimateTokens(fullText);

            // Try incremental parse to show progress
            const parsed = tryParseWorkflowJSON(fullText);
            const nodeCount = parsed?.nodes ? (parsed.nodes as unknown[]).length : lastParsedNodeCount;
            const edgeCount = parsed?.edges ? (parsed.edges as unknown[]).length : lastParsedEdgeCount;
            lastParsedNodeCount = nodeCount;
            lastParsedEdgeCount = edgeCount;

            set({
              streamedText: fullText,
              tokenCount: tokens,
              parsedNodeCount: nodeCount,
              parsedEdgeCount: edgeCount,
            });
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
            set({ error: props.error?.data?.message ?? "Generation failed", status: "error" });
            return;
          }
        }
      }

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

      // ── Final parse and load ──────────────────────────────────────────
      if (fullText.trim()) {
        // Strip markdown code fences if the LLM wrapped it
        let cleanText = fullText.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        }

        try {
          const parsed = JSON.parse(cleanText);

          // Validate against schema
          const result = workflowJsonSchema.safeParse(parsed);
          if (!result.success) {
            set({ error: `Generated workflow failed validation: ${result.error.message}`, status: "error" });
            return;
          }

          const workflowData = result.data as unknown as {
            name: string;
            nodes: WorkflowNode[];
            edges: WorkflowEdge[];
            ui: { sidebarOpen: boolean; minimapVisible: boolean; viewport: { x: number; y: number; zoom: number }; canvasMode?: string; edgeStyle?: string };
          };

          // ── Post-process: fix if-else / switch sourceHandles ──────────
          // LLMs sometimes use "branch-0"/"branch-1" instead of the real
          // handle IDs.  Build a lookup of node types so we can correct them.
          const nodeTypeMap = new Map<string, { type: string; branches?: Array<{ label: string }> }>();
          for (const n of workflowData.nodes) {
            const d = n.data as Record<string, unknown>;
            nodeTypeMap.set(n.id, {
              type: (d.type as string) ?? (n.type as string) ?? "",
              branches: d.branches as Array<{ label: string }> | undefined,
            });
          }

          workflowData.edges = workflowData.edges.map((edge) => {
            const sourceInfo = nodeTypeMap.get(edge.source);
            if (!sourceInfo) return edge;

            const handle = edge.sourceHandle;

            // Fix if-else: real handles are "true" (branch 0) / "false" (branch 1)
            if (sourceInfo.type === "if-else") {
              if (handle === "branch-0" || handle === "0") {
                return { ...edge, sourceHandle: "true" };
              }
              if (handle === "branch-1" || handle === "1") {
                return { ...edge, sourceHandle: "false" };
              }
            }

            // Fix switch: real handles are the branch label text
            if (sourceInfo.type === "switch" && sourceInfo.branches) {
              const branchMatch = handle?.match(/^branch-(\d+)$/);
              if (branchMatch) {
                const idx = parseInt(branchMatch[1], 10);
                if (idx < sourceInfo.branches.length) {
                  return { ...edge, sourceHandle: sourceInfo.branches[idx].label };
                }
              }
            }

            return edge;
          });

          // Load into the workflow store
          useWorkflowStore.getState().loadWorkflow(workflowData);

          // Auto-layout then fit view — Dagre + branch-ordering fix
          // ensures if-else "true" is above "false", switch branches
          // are top-to-bottom in definition order.
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("nexus:auto-layout"));
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("nexus:fit-view"));
            }, 500);
          }, 100);

          set({
            status: "done",
            parsedNodeCount: workflowData.nodes.length,
            parsedEdgeCount: workflowData.edges.length,
          });
        } catch (parseErr) {
          set({
            error: `Failed to parse generated JSON: ${parseErr instanceof Error ? parseErr.message : "Unknown error"}`,
            status: "error",
          });
        }
      } else {
        set({ error: "No response received from the AI model.", status: "error" });
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        set({ status: "idle", _abortController: null });
        return;
      }
      const msg = err instanceof Error ? err.message : "Generation failed";
      set({ error: msg, status: "error", _abortController: null });
    }
  },

  cancel: () => {
    const { _abortController, sessionId } = get();
    _abortController?.abort();

    const client = useOpenCodeStore.getState().client;
    if (client && sessionId) {
      client.sessions.abort(sessionId).catch(() => {});
    }

    set({ status: "idle", _abortController: null });
  },

  reset: () => {
    set({
      status: "idle",
      streamedText: "",
      parsedNodeCount: 0,
      parsedEdgeCount: 0,
      tokenCount: 0,
      error: null,
      _abortController: null,
    });
  },

  disposeSession: async () => {
    const { sessionId, _abortController } = get();
    _abortController?.abort();

    if (sessionId) {
      const client = useOpenCodeStore.getState().client;
      if (client) {
        try {
          await client.sessions.abort(sessionId).catch(() => {});
          await client.sessions.delete(sessionId).catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    set({
      sessionId: null,
      status: "idle",
      streamedText: "",
      parsedNodeCount: 0,
      parsedEdgeCount: 0,
      tokenCount: 0,
      error: null,
      _abortController: null,
    });
  },
}));


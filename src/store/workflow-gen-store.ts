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
  /** Whether the floating panel is visible */
  floating: boolean;
  /** Whether the floating panel body is collapsed */
  collapsed: boolean;
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
  /** Tracks which node IDs have already been added to the canvas */
  _addedNodeIds: Set<string>;
  /** Tracks which edge IDs have already been added to the canvas */
  _addedEdgeIds: Set<string>;
  /** Edges waiting for their source/target nodes to appear */
  _pendingEdges: Array<Record<string, unknown>>;

  // Actions
  setFloating: (open: boolean) => void;
  toggleCollapsed: () => void;
  close: () => void;
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
- Skill→Agent: sourceHandle: "skill-out", targetHandle: "skills" (skill nodes can ONLY connect to agent nodes)
- Document→Agent: sourceHandle: "doc-out", targetHandle: "docs" (document nodes can ONLY connect to agent nodes)

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

CRITICAL — Ask-user node edges:
- Ask-user nodes have TWO different modes that affect their output handles:

  MODE 1 — Single-select with manual options (multipleSelection: false AND aiSuggestOptions: false):
  - Each option gets its OWN output handle: "option-0", "option-1", "option-2", etc.
  - You MUST create one edge per option using "option-N" as the sourceHandle.
  - This means the ask-user node acts like a switch — each option branches to a different target. There is NO need for a separate switch or if-else node after it.
  - Option targets should be stacked top-to-bottom matching option order (option-0 target = smallest y, last option target = largest y).
  - Example: ask-user "ask-user-abc" at y:300 with 3 options:
    {"id":"e-ask-user-abc-agent-a","source":"ask-user-abc","target":"agent-a","sourceHandle":"option-0","targetHandle":"input"}  (agent-a at y:100)
    {"id":"e-ask-user-abc-agent-b","source":"ask-user-abc","target":"agent-b","sourceHandle":"option-1","targetHandle":"input"}  (agent-b at y:300)
    {"id":"e-ask-user-abc-agent-c","source":"ask-user-abc","target":"agent-c","sourceHandle":"option-2","targetHandle":"input"}  (agent-c at y:500)

  MODE 2 — Multi-select or AI-suggested options (multipleSelection: true OR aiSuggestOptions: true):
  - Uses a SINGLE output handle: "output" (just like a normal node).
  - The selected option(s) are passed as text to the next node in the flow.
  - Example: {"id":"e-ask-user-abc-agent-x","source":"ask-user-abc","target":"agent-x","sourceHandle":"output","targetHandle":"input"}

  DEFAULT: Use MODE 1 (single-select with manual options) unless the user specifically asks for multi-select or AI-generated options. This is the most common and useful pattern because it lets the workflow branch based on the user's choice.

Every branch MUST have an outgoing edge. Do NOT leave any branch unconnected.

## Available Node Types

${buildNodeCatalogue()}

## Understanding Skills and Documents

### Skills (type: "skill")
Skills are reusable knowledge/instruction units that get attached to agents. They represent specialised capabilities the agent should have. A skill node generates a \`.opencode/skills/<skillName>/SKILL.md\` file containing frontmatter (name, description, metadata) and the skill's instructions (promptText).

- **skillName**: A kebab-case slug used as the folder name (e.g. "code-review", "seo-optimization"). Must match [a-z0-9]+(-[a-z0-9]+)*.
- **description**: Explains what the skill does.
- **promptText**: The actual instructions/knowledge content for the skill. This should be detailed and production-ready.
- **metadata**: Optional key-value pairs (e.g. [{"key":"workflow","value":"github"}]).
- Skills connect ONLY to agent nodes via: sourceHandle: "skill-out", targetHandle: "skills".
- A skill is NOT part of the main workflow flow — it sits beside its parent agent and provides it with extra capabilities.
- Position skill nodes ABOVE their connected agent (same x, y offset -120 to -160).

Generated skill file template (\`.opencode/skills/<skillName>/SKILL.md\`):
\`\`\`
---
name: <skillName>
description: <description>
compatibility: opencode
metadata:
  workflow: github
---

<promptText content here - the actual skill instructions>
\`\`\`

### Documents (type: "document")
Documents are reference materials attached to agents. They provide context, data, or reference content the agent needs. A document node generates a \`.opencode/docs/<docName>.<ext>\` file.

- **docName**: A kebab-case slug used as the filename (e.g. "api-guide", "style-rules"). Must match [a-z0-9]+(-[a-z0-9]+)*.
- **contentMode**: "inline" (content typed directly in contentText) or "linked" (external file).
- **fileExtension**: "md", "txt", "json", or "yaml".
- **contentText**: The actual document content when contentMode is "inline". Write meaningful reference content.
- **description**: Explains what the document contains.
- Documents connect ONLY to agent nodes via: sourceHandle: "doc-out", targetHandle: "docs".
- A document is NOT part of the main workflow flow — it sits beside its parent agent and feeds it context.
- Position document nodes BELOW their connected agent (same x, y offset +120 to +160).

Generated document file template (\`.opencode/docs/<docName>.<ext>\`):
\`\`\`
<contentText content here - the actual document content>
\`\`\`

### How Skills and Documents Attach to Agents
When skills/documents are connected to an agent, they appear in the generated agent file's frontmatter:
\`\`\`
---
description: <agent description>
mode: subagent
hidden: true
skills:
  - <skillName1>
  - <skillName2>
docs:
  - <docName1>.<ext>
  - <docName2>.<ext>
color: "#5f27cd"
---

<agent promptText here>
\`\`\`

## Agent Template (Generated .opencode/agents/<name>.md)
Each agent node produces a \`.opencode/agents/<agentName>.md\` file. The agent's promptText becomes the main body of this file. Write detailed, production-ready prompts.

Full agent file template:
\`\`\`
---
description: <description of what the agent does>
mode: subagent
hidden: true
model: <model if not "inherit">
memory: <memory if not "default">
tools:
  <disabledToolName>: false
skills:
  - <connected skill names>
docs:
  - <connected document names>
temperature: <temperature if > 0>
color: "<color hex>"
---

## Variables
- \\\`varName\\\`: \\\`resolved/path\\\`

<promptText — the full agent instructions>
\`\`\`

The promptText for agents should be a comprehensive, multi-paragraph system prompt that tells the agent exactly what to do, how to handle edge cases, what output format to use, etc. Think of it like writing a system prompt for a real AI agent.

## Node Data Templates

start: {"type":"start","label":"Start","name":"<id>"}
end: {"type":"end","label":"End","name":"<id>"}
agent: {"type":"agent","label":"<label>","name":"<id>","description":"<desc>","promptText":"<detailed multi-line agent instructions>","detectedVariables":[],"model":"inherit","memory":"default","temperature":0,"color":"#5f27cd","disabledTools":[],"parameterMappings":[],"variableMappings":{}}
prompt: {"type":"prompt","label":"<label>","name":"<id>","promptText":"<text>","detectedVariables":[]}
skill: {"type":"skill","label":"<label>","name":"<id>","skillName":"<kebab-case-name>","projectName":"","description":"<what this skill does>","promptText":"<detailed skill instructions and knowledge content>","detectedVariables":[],"metadata":[{"key":"workflow","value":"github"}]}
document: {"type":"document","label":"<label>","name":"<id>","docName":"<kebab-case-name>","contentMode":"inline","fileExtension":"md","contentText":"<actual document content - reference material, guides, data>","linkedFileName":"","linkedFileContent":"","description":"<what this document contains>"}
mcp-tool: {"type":"mcp-tool","label":"<label>","name":"<id>","toolName":"<name>","paramsText":""}
if-else: {"type":"if-else","label":"<label>","name":"<id>","evaluationTarget":"<target>","branches":[{"label":"If <cond>","condition":"<cond>"},{"label":"Else","condition":"else"}]}
switch: {"type":"switch","label":"<label>","name":"<id>","evaluationTarget":"<target>","branches":[{"label":"<case>","condition":"<cond>"}]}
ask-user: {"type":"ask-user","label":"<label>","name":"<id>","questionText":"<question>","multipleSelection":false,"aiSuggestOptions":false,"options":[{"label":"<option1>","description":"<desc1>"},{"label":"<option2>","description":"<desc2>"}]}
  NOTE: With multipleSelection:false and aiSuggestOptions:false (the default), each option becomes its own output handle (option-0, option-1, ...). Create one edge per option to branch the flow. At least 2 options are required.
sub-workflow: {"type":"sub-workflow","label":"<label>","name":"<id>","mode":"same-context","subNodes":[],"subEdges":[],"nodeCount":0,"description":"","model":"inherit","memory":"default","temperature":0,"color":"#a855f7","disabledTools":[]}

## Important Guidelines
- Generate meaningful labels, descriptions, and promptText content. Make it production-ready.
- When an agent needs specific capabilities, create skill nodes with detailed instructions and connect them.
- When an agent needs reference data, context, or guides, create document nodes with real content and connect them.
- Agent promptText should be comprehensive — write it as a real system prompt for an AI agent.
- Skill promptText should contain the actual skill instructions/knowledge (not just a placeholder).
- Document contentText should contain actual reference content (not just a placeholder).

NOW OUTPUT ONLY JSON.`;
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

/** Fix if-else / switch / ask-user sourceHandles on a set of edges using node type info. */
function fixEdgeHandles(
  edges: Array<Record<string, unknown>>,
  nodeTypeMap: Map<string, { type: string; branches?: Array<{ label: string }>; options?: Array<{ label: string }>; multipleSelection?: boolean; aiSuggestOptions?: boolean }>,
): WorkflowEdge[] {
  return edges.map((edge) => {
    const sourceInfo = nodeTypeMap.get(edge.source as string);
    if (!sourceInfo) return { ...edge, type: "deletable" } as unknown as WorkflowEdge;

    const handle = edge.sourceHandle as string | undefined;

    if (sourceInfo.type === "if-else") {
      if (handle === "branch-0" || handle === "0") {
        return { ...edge, sourceHandle: "true", type: "deletable" } as unknown as WorkflowEdge;
      }
      if (handle === "branch-1" || handle === "1") {
        return { ...edge, sourceHandle: "false", type: "deletable" } as unknown as WorkflowEdge;
      }
    }

    if (sourceInfo.type === "switch" && sourceInfo.branches) {
      const branchMatch = handle?.match(/^branch-(\d+)$/);
      if (branchMatch) {
        const idx = parseInt(branchMatch[1], 10);
        if (idx < sourceInfo.branches.length) {
          return { ...edge, sourceHandle: sourceInfo.branches[idx].label, type: "deletable" } as unknown as WorkflowEdge;
        }
      }
    }

    // Fix ask-user: when single-select (not multi, not AI), handles are "option-N"
    // LLM might use "branch-N" instead
    if (sourceInfo.type === "ask-user" && !sourceInfo.multipleSelection && !sourceInfo.aiSuggestOptions) {
      const branchMatch = handle?.match(/^branch-(\d+)$/);
      if (branchMatch) {
        return { ...edge, sourceHandle: `option-${branchMatch[1]}`, type: "deletable" } as unknown as WorkflowEdge;
      }
    }

    return { ...edge, type: "deletable" } as unknown as WorkflowEdge;
  });
}

export const useWorkflowGenStore = create<WorkflowGenState>((set, get) => ({
  floating: false,
  collapsed: false,
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
  _addedNodeIds: new Set<string>(),
  _addedEdgeIds: new Set<string>(),
  _pendingEdges: [],

  setFloating: (open) => {
    if (!open) {
      const { status, _abortController } = get();
      if (status === "streaming" || status === "creating-session") {
        _abortController?.abort();
      }
    }
    set({ floating: open });
  },

  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),

  close: () => {
    const { status, _abortController } = get();
    if (status === "streaming" || status === "creating-session") {
      _abortController?.abort();
    }
    set({ floating: false });
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

    // Clear the canvas before starting a new generation
    useWorkflowStore.getState().reset();

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
    const addedNodeIds = new Set<string>();
    const addedEdgeIds = new Set<string>();
    let pendingEdges: Array<Record<string, unknown>> = [];
    /** Snapshot of the last-known data per node so we can detect real changes */
    const nodeDataSnapshots = new Map<string, string>();

    set({
      status: "streaming",
      streamedText: "",
      parsedNodeCount: 0,
      parsedEdgeCount: 0,
      tokenCount: 0,
      error: null,
      _abortController: abortController,
      _addedNodeIds: addedNodeIds,
      _addedEdgeIds: addedEdgeIds,
      _pendingEdges: [],
    });

    // Parse selected model
    const slashIdx = selectedModel.indexOf("/");
    const providerId = slashIdx > 0 ? selectedModel.slice(0, slashIdx) : "";
    const modelId = slashIdx > 0 ? selectedModel.slice(slashIdx + 1) : selectedModel;

    /**
     * Check whether a raw node object looks "complete enough" to render.
     * Requires id, position with both x/y, and data with type + label.
     * The last node in the array is likely still being streamed — we also
     * require `name` for it as a safety gate.
     */
    const isNodeReady = (raw: Record<string, unknown>, isLast: boolean): boolean => {
      if (!raw.id) return false;
      const pos = raw.position as Record<string, unknown> | undefined;
      if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return false;
      const d = raw.data as Record<string, unknown> | undefined;
      if (!d || !d.type || !d.label) return false;
      if (isLast && !d.name) return false;
      return true;
    };

    /** Check if an edge has all required fields. */
    const isEdgeReady = (raw: Record<string, unknown>): boolean => {
      return !!(raw.id && raw.source && raw.target);
    };

    /** Push newly parsed nodes and edges incrementally to the canvas. */
    const pushIncremental = (parsed: {
      name?: string;
      nodes?: Array<Record<string, unknown>>;
      edges?: Array<Record<string, unknown>>;
    }) => {
      const wfStore = useWorkflowStore.getState();

      // Set workflow name once available
      if (parsed.name && wfStore.name !== parsed.name) {
        wfStore.setName(parsed.name);
      }

      // Build node type map for edge handle fixing
      const nodeTypeMap = new Map<string, { type: string; branches?: Array<{ label: string }>; options?: Array<{ label: string }>; multipleSelection?: boolean; aiSuggestOptions?: boolean }>();

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
        ...pendingEdges,
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

      pendingEdges = stillPending;

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
    };

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

      // Stream SSE events with throttled parse+push
      let fullText = "";
      let lastParsedNodeCount = 0;
      let lastParsedEdgeCount = 0;
      let parseTimer: ReturnType<typeof setTimeout> | null = null;
      const PARSE_INTERVAL_MS = 150;

      /** Run an incremental parse and push results to canvas. */
      const doParse = () => {
        const parsed = tryParseWorkflowJSON(fullText);
        if (!parsed) return;

        const nodeCount = parsed.nodes ? (parsed.nodes as unknown[]).length : lastParsedNodeCount;
        const edgeCount = parsed.edges ? (parsed.edges as unknown[]).length : lastParsedEdgeCount;
        lastParsedNodeCount = nodeCount;
        lastParsedEdgeCount = edgeCount;

        pushIncremental(parsed);

        set({ parsedNodeCount: nodeCount, parsedEdgeCount: edgeCount });
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

            // Throttled parse — avoids thrashing React on every token
            if (!parseTimer) {
              parseTimer = setTimeout(() => {
                parseTimer = null;
                doParse();
              }, PARSE_INTERVAL_MS);
            }
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
            if (parseTimer) clearTimeout(parseTimer);
            useWorkflowStore.temporal.getState().resume();
            set({ error: props.error?.data?.message ?? "Generation failed", status: "error" });
            return;
          }
        }
      }

      // Flush any pending throttled parse
      if (parseTimer) { clearTimeout(parseTimer); parseTimer = null; }
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

        try {
          const parsed = JSON.parse(cleanText);

          // Validate against schema
          const result = workflowJsonSchema.safeParse(parsed);
          if (!result.success) {
            useWorkflowStore.temporal.getState().resume();
            set({ error: `Generated workflow failed validation: ${result.error.message}`, status: "error" });
            return;
          }

          // Push any remaining nodes/edges that weren't caught during streaming
          pushIncremental(parsed);

          // Force flush any remaining pending edges
          if (pendingEdges.length > 0) {
            const nodeTypeMap = new Map<string, { type: string; branches?: Array<{ label: string }>; options?: Array<{ label: string }>; multipleSelection?: boolean; aiSuggestOptions?: boolean }>();
            if (parsed.nodes) {
              for (const n of parsed.nodes as Array<Record<string, unknown>>) {
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
            }
            const fixedEdges = fixEdgeHandles(pendingEdges, nodeTypeMap);
            const existingEdges = useWorkflowStore.getState().edges;
            useWorkflowStore.setState({ edges: [...existingEdges, ...fixedEdges] });
            pendingEdges = [];
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
            parsedNodeCount: finalNodes.length,
            parsedEdgeCount: finalEdges.length,
          });
        } catch (parseErr) {
          useWorkflowStore.temporal.getState().resume();
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
        try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }
        set({ status: "idle", _abortController: null });
        return;
      }
      try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }
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

    // Resume undo/redo in case it was paused
    try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }

    set({
      status: "idle",
      _abortController: null,
      _addedNodeIds: new Set(),
      _addedEdgeIds: new Set(),
      _pendingEdges: [],
    });
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
      _addedNodeIds: new Set(),
      _addedEdgeIds: new Set(),
      _pendingEdges: [],
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
      _addedNodeIds: new Set(),
      _addedEdgeIds: new Set(),
      _pendingEdges: [],
    });
  },
}));


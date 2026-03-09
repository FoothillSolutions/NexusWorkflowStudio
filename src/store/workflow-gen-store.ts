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
  /** Node IDs currently showing the AI rainbow border (reactive — components subscribe to this) */
  _glowingNodeIds: string[];

  // ── Project folder context ──
  /** Whether to include the selected project folder's file tree as context */
  useProjectContext: boolean;
  /** The fetched project folder context string (file tree) */
  projectContext: string | null;
  /** Status of folder context fetching */
  projectContextStatus: "idle" | "loading" | "done" | "error";

  // ── AI-generated examples ──
  /** AI-suggested example prompts (supplement the hardcoded ones) */
  aiExamples: string[];
  /** Status of the AI example generation */
  aiExamplesStatus: "idle" | "loading" | "done" | "error";
  /** Session ID used for generating examples (separate from the main gen session) */
  _examplesSessionId: string | null;
  /** AbortController for the examples request */
  _examplesAbortController: AbortController | null;

  // Actions
  setFloating: (open: boolean) => void;
  toggleCollapsed: () => void;
  close: () => void;
  setPrompt: (prompt: string) => void;
  setSelectedModel: (model: string) => void;
  setUseProjectContext: (use: boolean) => void;
  /** Fetch the project folder's file tree for context */
  fetchProjectContext: () => Promise<void>;
  generate: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  disposeSession: () => Promise<void>;
  /** Fetch AI-generated example prompts using the connected model */
  fetchAiExamples: () => Promise<void>;
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

/** Recursively fetch a project file tree and format it as an indented string. */
async function fetchFileTree(
  client: { files: { list: (path: string) => Promise<Array<{ name: string; path: string; type: "file" | "directory"; ignored: boolean }>> } },
  rootPath: string,
  maxDepth: number = 3,
  maxFiles: number = 200,
): Promise<string> {
  let fileCount = 0;
  const IGNORED_DIRS = new Set([
    "node_modules", ".git", ".next", "dist", "build", "__pycache__",
    ".venv", "venv", ".tox", ".mypy_cache", ".pytest_cache",
    "target", ".idea", ".vscode", ".DS_Store", "coverage",
  ]);

  async function walk(path: string, depth: number, prefix: string): Promise<string[]> {
    if (depth > maxDepth || fileCount >= maxFiles) return [];
    try {
      const entries = await client.files.list(path);
      const lines: string[] = [];
      // Sort: directories first, then files
      const sorted = [...entries].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "directory" ? -1 : 1;
      });
      for (const entry of sorted) {
        if (fileCount >= maxFiles) {
          lines.push(`${prefix}… (truncated — ${maxFiles} file limit)`);
          break;
        }
        if (entry.ignored || IGNORED_DIRS.has(entry.name)) continue;
        if (entry.type === "directory") {
          lines.push(`${prefix}${entry.name}/`);
          const children = await walk(entry.path, depth + 1, prefix + "  ");
          lines.push(...children);
        } else {
          lines.push(`${prefix}${entry.name}`);
          fileCount++;
        }
      }
      return lines;
    } catch {
      return [`${prefix}(unable to read)`];
    }
  }

  const lines = await walk(rootPath, 0, "  ");
  return lines.join("\n");
}

/** Build the system prompt that instructs the LLM how to generate workflows. */
function buildSystemPrompt(projectContext?: string | null): string {
  const contextSection = projectContext
    ? `\n\n## Project Context\nThe user has a project with the following file structure. Use this to inform agent names, skill content, document references, and overall workflow design. Tailor the workflow to be relevant to this project:\n\`\`\`\n${projectContext}\n\`\`\`\n`
    : "";

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
  - Node widths by type (use these to calculate horizontal spacing):
    - small nodes (180px wide): start, end, skill, document, mcp-tool
    - medium nodes (250px wide): if-else, switch, ask-user
    - large nodes (350px wide): agent, prompt, sub-workflow
  - Horizontal spacing: place each subsequent column so there is at least 150px of empty gap between the right edge of the previous node and the left edge of the next one. 
    Formula: next_x = prev_x + prev_node_width + 150.
    Examples: start (180px) at x:80 → next node at x:80+180+150 = x:410. agent (350px) at x:410 → next at x:410+350+150 = x:910. if-else (250px) at x:910 → next at x:910+250+150 = x:1310.
    IMPORTANT: When an agent has skill or document nodes, those sit to the LEFT of the agent (behind it). You must leave extra horizontal room so they don't overlap with the previous node. If an agent has skills/docs, increase the gap between the PREVIOUS node and the agent to at least 400px (i.e. next_x = prev_x + prev_node_width + 400). This accounts for the 180px skill/doc width + 60px gap + extra breathing room.
  - Start node at x:80, y:300.
  - Flow left-to-right. Calculate each column's x using the formula above.
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
- Position skill nodes BEHIND (to the LEFT of) their connected agent AND BELOW the agent's bottom edge.
  Formula: skill_x = agent_x - 180 - 40 (skill width + 40px gap). skill_y = agent_y + agent_height + 30 (30px below agent baseline).
  For an agent at x:410 y:240 (350×120): skill at x:190 y:390. If multiple skills, stack them vertically downward with 16px gap between them.

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
- Position document nodes BEHIND (to the LEFT of) their connected agent AND BELOW the agent's bottom edge.
  Use the same x column as skills: doc_x = agent_x - 180 - 40. doc_y = agent_y + agent_height + 30 (below agent baseline).
  If an agent has BOTH skills and documents, stack them in the same column behind the agent below the baseline: skills first, documents below, each with 16px vertical gap.

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
${contextSection}
NOW OUTPUT ONLY JSON.`;
}

// ── Streaming JSON extractor ─────────────────────────────────────────────
// Instead of trying to "repair" incomplete JSON (which fails when the LLM
// is mid-way through a string with special characters), we extract
// individual complete JSON objects from the "nodes" and "edges" arrays
// as they stream in.  This way each node/edge appears on the canvas the
// moment its closing `}` arrives, without waiting for the rest.

/**
 * Extract the workflow name from a partial JSON stream.
 * Looks for `"name": "..."` near the start, before the "nodes" array.
 */
function extractName(text: string): string | undefined {
  // Only search in the portion before "nodes" to avoid matching node "name" fields
  const nodesIdx = text.indexOf('"nodes"');
  const searchArea = nodesIdx > 0 ? text.slice(0, nodesIdx) : text.slice(0, 200);
  const m = searchArea.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : undefined;
}

/**
 * Find the start of a top-level array value for a given key.
 * Returns the index of the `[` character, or -1 if not found.
 * "Top-level" means inside the outermost `{` only (depth 1).
 */
function findArrayStart(text: string, key: string): number {
  const pattern = `"${key}"`;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') {
      // Before toggling string state, check if this is our key at the right depth
      if (!inStr && braceDepth === 1 && bracketDepth === 0 && text.startsWith(pattern, i)) {
        // Found the key — skip past it and find the `[`
        let j = i + pattern.length;
        while (j < text.length && /\s|:/.test(text[j])) j++;
        if (j < text.length && text[j] === '[') return j;
      }
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
    if (ch === '[') bracketDepth++;
    if (ch === ']') bracketDepth--;
  }
  return -1;
}

/**
 * Given text starting from `[`, extract all complete top-level objects
 * (depth 1 inside the array = complete `{…}` blocks). Returns the
 * parsed objects and the index up to which we've consumed.
 */
function extractCompleteObjects(text: string, arrayStart: number): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  let i = arrayStart + 1; // skip the `[`
  let inStr = false;
  let esc = false;
  let depth = 0;
  let objStart = -1;

  while (i < text.length) {
    const ch = text[i];
    if (esc) { esc = false; i++; continue; }
    if (ch === '\\' && inStr) { esc = true; i++; continue; }
    if (ch === '"') { inStr = !inStr; i++; continue; }
    if (inStr) { i++; continue; }

    // End of the array
    if (ch === ']' && depth === 0) break;

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const objStr = text.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(objStr);
          results.push(obj);
        } catch {
          // Malformed object — skip it
        }
        objStart = -1;
      }
    }
    i++;
  }
  return results;
}

interface StreamParseResult {
  name?: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}

/**
 * Incrementally extract workflow data from a partial JSON stream.
 * Unlike tryParseWorkflowJSON, this never fails — it simply returns
 * whatever complete nodes/edges have been streamed so far.
 */
function extractStreamedWorkflow(text: string): StreamParseResult {
  const name = extractName(text);

  const nodesStart = findArrayStart(text, "nodes");
  const nodes = nodesStart >= 0 ? extractCompleteObjects(text, nodesStart) : [];

  const edgesStart = findArrayStart(text, "edges");
  const edges = edgesStart >= 0 ? extractCompleteObjects(text, edgesStart) : [];

  return { name, nodes, edges };
}

/**
 * Attempt to parse the complete JSON (for final validation).
 * Returns null if the JSON is not yet complete.
 */
function tryParseCompleteJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

/**
 * Module-level sets are no longer used for animation tracking.
 * Animation state is now reactive via `_glowingNodeIds` in the store,
 * so components re-render when the glowing set changes.
 */

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
  _glowingNodeIds: [],

  // ── Project folder context ──
  useProjectContext: false,
  projectContext: null,
  projectContextStatus: "idle",

  // ── AI examples ──
  aiExamples: [],
  aiExamplesStatus: "idle",
  _examplesSessionId: null,
  _examplesAbortController: null,

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

  setUseProjectContext: (use) => {
    set({ useProjectContext: use });
    if (use && get().projectContextStatus === "idle") {
      // Auto-fetch when toggled on
      get().fetchProjectContext();
    }
  },

  fetchProjectContext: async () => {
    const { projectContextStatus } = get();
    if (projectContextStatus === "loading") return;

    const client = useOpenCodeStore.getState().client;
    const project = useOpenCodeStore.getState().currentProject;
    if (!client) {
      set({ projectContext: null, projectContextStatus: "error" });
      return;
    }

    set({ projectContextStatus: "loading", projectContext: null });

    try {
      const rootPath = project?.worktree ?? ".";
      const tree = await fetchFileTree(client, rootPath);
      const projectName = project?.name ?? project?.worktree?.split(/[/\\]/).pop() ?? "project";
      const contextStr = `Project: ${projectName}\nRoot: ${project?.worktree ?? "(default)"}\n\n${tree}`;
      set({ projectContext: contextStr, projectContextStatus: "done" });
    } catch {
      set({ projectContext: null, projectContextStatus: "error" });
    }
  },

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
      const { useProjectContext, projectContext } = get();
      const systemPrompt = buildSystemPrompt(useProjectContext ? projectContext : null);

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
          pushIncremental(parsed);
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
        pushIncremental(finalStreamed);

        // Force flush any remaining pending edges
        if (pendingEdges.length > 0) {
          const nodeTypeMap = new Map<string, { type: string; branches?: Array<{ label: string }>; options?: Array<{ label: string }> ; multipleSelection?: boolean; aiSuggestOptions?: boolean }>();
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
          const fixedEdges = fixEdgeHandles(pendingEdges, nodeTypeMap);
          const existingEdges = useWorkflowStore.getState().edges;
          useWorkflowStore.setState({ edges: [...existingEdges, ...fixedEdges] });
          pendingEdges = [];
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
      _glowingNodeIds: [],
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
      _glowingNodeIds: [],
    });
  },

  disposeSession: async () => {
    const { sessionId, _abortController, _examplesSessionId, _examplesAbortController } = get();
    _abortController?.abort();
    _examplesAbortController?.abort();

    const client = useOpenCodeStore.getState().client;
    if (client) {
      if (sessionId) {
        try {
          await client.sessions.abort(sessionId).catch(() => {});
          await client.sessions.delete(sessionId).catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
      if (_examplesSessionId) {
        try {
          await client.sessions.abort(_examplesSessionId).catch(() => {});
          await client.sessions.delete(_examplesSessionId).catch(() => {});
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
      _glowingNodeIds: [],
      aiExamples: [],
      aiExamplesStatus: "idle",
      _examplesSessionId: null,
      _examplesAbortController: null,
      projectContext: null,
      projectContextStatus: "idle",
    });
  },

  fetchAiExamples: async () => {
    const { aiExamplesStatus, _examplesAbortController: prevAc, selectedModel } = get();

    // Don't re-fetch if already loading or done
    if (aiExamplesStatus === "loading" || aiExamplesStatus === "done") return;

    const client = useOpenCodeStore.getState().client;
    if (!client) return;

    // Need a model selected
    if (!selectedModel) return;

    prevAc?.abort();
    const abortController = new AbortController();
    set({ aiExamplesStatus: "loading", _examplesAbortController: abortController });

    try {
      // Ensure a session for examples
      let sid = get()._examplesSessionId;
      if (!sid) {
        const session = await client.sessions.create({ title: "Nexus Workflow Examples" });
        sid = session.id;
        set({ _examplesSessionId: sid });
      }

      const slashIdx = selectedModel.indexOf("/");
      const providerId = slashIdx > 0 ? selectedModel.slice(0, slashIdx) : "";
      const modelId = slashIdx > 0 ? selectedModel.slice(slashIdx + 1) : selectedModel;

      // Send prompt async
      await client.messages.sendAsync(sid, {
        parts: [{ type: "text", text: "Generate 5 creative and diverse workflow prompt ideas that a user might want to build. Each should involve multiple node types (agents, if-else, switch, ask-user, skills, documents, sub-workflows). Return ONLY a JSON array of 5 strings, no explanation. Example format: [\"prompt 1\", \"prompt 2\", ...]" }],
        model: { providerID: providerId, modelID: modelId },
        system: "You output ONLY valid JSON arrays of strings. No markdown, no code fences, no explanation. Just the JSON array.",
      }, { signal: abortController.signal });

      // Stream events
      let fullText = "";
      for await (const event of client.events.subscribe({ signal: abortController.signal })) {
        if (abortController.signal.aborted) break;

        if (event.type === "message.part.delta") {
          const props = event.properties as { sessionID: string; field: string; delta: string };
          if (props.sessionID === sid && props.field === "text") {
            fullText += props.delta;
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
            set({ aiExamplesStatus: "error", _examplesAbortController: null });
            return;
          }
        }
      }

      // Parse the JSON array from the response
      try {
        // Strip code fences if the model wraps them anyway
        let cleaned = fullText.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        }
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          const examples = parsed
            .filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
            .map((s: string) => s.trim());
          set({ aiExamples: examples, aiExamplesStatus: "done", _examplesAbortController: null });
        } else {
          set({ aiExamplesStatus: "error", _examplesAbortController: null });
        }
      } catch {
        set({ aiExamplesStatus: "error", _examplesAbortController: null });
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        set({ aiExamplesStatus: "idle", _examplesAbortController: null });
        return;
      }
      set({ aiExamplesStatus: "error", _examplesAbortController: null });
    }
  },
}));


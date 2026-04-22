// ─── System Prompt Builder ───────────────────────────────────────────────────
// Constructs the full system prompt sent to the LLM for workflow generation.
// Per-node instructions are assembled dynamically from NODE_REGISTRY entries'
// aiGenerationPrompt fields. Global/structural rules remain here.

import { NODE_REGISTRY } from "@/lib/node-registry";
import type { AiGenerationPrompt, NodeRegistryEntry } from "@/nodes/shared/registry-types";

/** Only include nodes the AI is allowed to generate — inactive ("coming soon")
 *  nodes are hidden from the prompt entirely so the LLM never emits them. */
function activeRegistryEntries(): Array<[string, NodeRegistryEntry]> {
  return Object.entries(NODE_REGISTRY).filter(
    ([, entry]) => entry.active !== false,
  );
}

// ─── Per-node section builders ───────────────────────────────────────────────

/** Build the catalogue of available node types for the system prompt.
 *  For nodes that have an `aiGenerationPrompt`, uses its description.
 *  For nodes without one, falls back to dumping `defaultData()` fields. */
function buildNodeCatalogue(): string {
  const lines: string[] = [];
  for (const [type, entry] of activeRegistryEntries()) {
    const prompt = entry.aiGenerationPrompt;
    if (prompt) {
      lines.push(`### ${type}
- Display name: ${entry.displayName}
- Category: ${entry.category}
- ${prompt.description}
`);
    } else {
      // Backward-compat fallback for nodes without aiGenerationPrompt
      const defaults = entry.defaultData();
      const { type: _t, label: _l, name: _n, ...dataFields } = defaults as Record<string, unknown>;
      const fieldList = Object.keys(dataFields).length > 0
        ? `  Data fields: ${JSON.stringify(dataFields, null, 2).split("\n").join("\n  ")}`
        : "  No additional data fields.";

      lines.push(`### ${type}
- Display name: ${entry.displayName}
- Category: ${entry.category}
${fieldList}
`);
    }
  }
  return lines.join("\n");
}
/** Build per-node edge rules from aiGenerationPrompt.edgeRules. */
function buildNodeEdgeRules(): string {
  const sections: string[] = [];
  for (const [, entry] of activeRegistryEntries()) {
    const prompt = entry.aiGenerationPrompt;
    if (prompt?.edgeRules) {
      sections.push(prompt.edgeRules);
    }
  }
  return sections.join("\n\n");
}

/** Build a combined "Node Relationships" section from nodes with connectionRules. */
function buildRelationshipSections(): string {
  const sections: string[] = [];
  for (const [type, entry] of activeRegistryEntries()) {
    const prompt = entry.aiGenerationPrompt;
    if (prompt?.connectionRules) {
      sections.push(`### ${entry.displayName} (${type})\n${prompt.connectionRules}`);
    }
  }
  if (sections.length === 0) return "";
  return sections.join("\n\n");
}

/** Build per-node generation hints. */
function buildNodeGuidelines(): string {
  const hints: string[] = [];
  for (const [, entry] of activeRegistryEntries()) {
    const prompt = entry.aiGenerationPrompt;
    if (prompt?.generationHints?.length) {
      for (const hint of prompt.generationHints) {
        hints.push(`- ${hint}`);
      }
    }
    if (prompt?.examples?.length) {
      for (const example of prompt.examples) {
        hints.push(example);
      }
    }
  }
  return hints.join("\n");
}

/** Build supplementary note blocks for nodes with extra template details.
 *  These are appended directly after the data template line for the node. */
function buildNodeDataTemplatesWithNotes(): string {
  const lines: string[] = [];
  for (const [type, entry] of activeRegistryEntries()) {
    const prompt = entry.aiGenerationPrompt;
    if (!prompt) continue;

    lines.push(`${type}: ${prompt.dataTemplate}`);

    // Add inline notes for specific node types that have substantial extra context
    // These correspond to the NOTE blocks in the original hardcoded prompt
    const notes = buildNoteForNode(type, prompt);
    if (notes) {
      lines.push(notes);
    }
  }
  return lines.join("\n");
}

/** Build a NOTE block for nodes that need extra explanation beyond the template. */
function buildNoteForNode(type: string, prompt: AiGenerationPrompt): string | null {
  // Nodes with substantial extra context get NOTE blocks
  const noteHints: string[] = [];

  if (prompt.generationHints?.length) {
    for (const hint of prompt.generationHints) {
      // Filter to only template-relevant hints (not positioning/general advice)
      if (isTemplateNote(type, hint)) {
        noteHints.push(hint);
      }
    }
  }

  // For specific node types, generate the structured NOTE from their prompt data
  switch (type) {
    case "parallel-agent":
      return `  NOTE on parallel-agent:
  - This is a rectangular workflow node that spawns connected external agent nodes in parallel.
  - EVERY outgoing edge from a parallel-agent MUST target a node with \`type === "agent"\`. The connected agent is the one that gets spawned for that branch — there is no other way to say "spawn this kind of agent" except by wiring the branch to an agent node of that type/definition.
  - \`spawnMode\` discriminates behavior:
    - "fixed" (default): hand-authored list of branches. Each branch has its own output handle \`branch-<index>\` and MUST be connected to exactly one external \`agent\` node — that connected agent is the one spawned for the branch. \`spawnCount\` on each branch = parallel runs of that target agent. Branch \`instructions\` describe the lane's focus.
    - "dynamic": a single output handle \`"output"\` that MUST be connected to exactly ONE external \`agent\` (the template agent cloned at runtime for every spawned instance). \`branches\` MUST be an empty array. \`spawnCriterion\` is REQUIRED non-empty. \`spawnMin >= 1\`, \`spawnMax >= spawnMin\` bound the runtime count.
  - In dynamic spawn mode the parallel-agent node has EXACTLY ONE outgoing edge to ONE template Agent node — never emit branch-N handles in dynamic mode.
  - CRITICAL — branch instructions vs agent promptText:
    - branch instructions live on the branch object. The branch's \`instructions\` field is an upstream descriptor that the runtime surfaces to the connected agent.
    - DO NOT copy the branch instruction into the agent's promptText. The agent's \`promptText\` is its own role; the branch instruction is a per-lane directive.
  - \`sharedInstructions\` applies to every spawned agent in both modes.
  - Shared skills/documents can connect to the parallel-agent node and are available to every spawned agent.
  - Every parallel-agent node MUST have its output(s) fully connected: fixed = one edge per branch handle; dynamic = exactly one edge from \`"output"\` to an agent.`;
    case "ask-user":
      return `  NOTE: With multipleSelection:false and aiSuggestOptions:false (the default), each option becomes its own output handle (option-0, option-1, ...). Create one edge per option to branch the flow directly. Do not add a redundant switch or if-else right after this node. At least 2 options are required.`;
    case "sub-workflow":
      return `  NOTE on sub-workflow:
  - mode can be "same-context" (runs inline, shares parent context) or "agent" (spawns a dedicated sub-agent). When mode is "agent", fill in description, model, memory, temperature, and color.
  - subNodes and subEdges define the INNER workflow of the sub-workflow. They follow the exact same node/edge schema as the top-level nodes/edges.
  - A sub-workflow MUST contain at least a start node and an end node inside subNodes, plus any other nodes (agents, prompts, if-else, etc.) that form the inner flow.
  - subEdges connect the inner nodes together, using the same format as top-level edges.
  - nodeCount should equal the number of subNodes.
  - Example with inner nodes: ${prompt.examples?.[0] ?? ""}`;
    default:
      return null;
  }
}

/** Determine if a generation hint is a template-specific note (vs general advice). */
function isTemplateNote(_type: string, _hint: string): boolean {
  // Currently all template notes are handled in buildNoteForNode switch
  return false;
}

// ─── Main prompt builder ────────────────────────────────────────────────────

/** Build the system prompt that instructs the LLM how to generate workflows. */
export function buildSystemPrompt(opts?: {
  projectContext?: string | null;
  availableModels?: string[];
  availableTools?: string[];
  mode?: "generate" | "edit";
}): string {
  const { projectContext, availableModels, availableTools, mode } = opts ?? {};
  const contextSection = projectContext
    ? `\n\n## Project Context\nThe user has a project with the following file structure. Use this to inform agent names, skill content, document references, and overall workflow design. Tailor the workflow to be relevant to this project:\n\`\`\`\n${projectContext}\n\`\`\`\n`
    : "";

  const modelsSection = availableModels && availableModels.length > 0
    ? `\n\n## Available Models\nThe following models are available for use in agent "model" fields. Use the full "provider/modelId" value. If you set model to "inherit", the agent inherits the parent's model.\nPrefer Claude (Anthropic) models as the default for most agents. Use lighter/cheaper models for simple tasks (e.g. summarisation, formatting) and more capable models for complex reasoning tasks.\n\nAvailable models:\n${availableModels.map((m) => `- ${m}`).join("\n")}\n`
    : "";

  const toolsSection = availableTools && availableTools.length > 0
    ? `\n\n## Available Tools\nThe following tools are available for agents. By default ALL tools are enabled. Only add tool names to the "disabledTools" array if you want to DISABLE specific tools for that agent. Only disable tools that are not relevant to the agent's task.\n\nAvailable tools: ${availableTools.join(", ")}\n`
    : "";

  const editModeSection = mode === "edit"
    ? `\n## Edit Mode Rules
You are editing an existing workflow. The user will include the current WorkflowJSON and a change request.
- Return a single complete WorkflowJSON (not a diff).
- Copy unchanged nodes, edges, and sub-workflow contents VERBATIM from the input — same ids, positions, and data fields.
- Only mutate what the user's change request requires.
- Do not rename ids, do not reformat positions, do not drop the \`ui\` block.
- The same start/end/edge-handle rules from earlier still apply.
`
    : "";

  // Dynamically assembled sections
  const nodeCatalogue = buildNodeCatalogue();
  const nodeEdgeRules = buildNodeEdgeRules();
  const nodeDataTemplates = buildNodeDataTemplatesWithNotes();
  const relationshipSections = buildRelationshipSections();
  const nodeGuidelines = buildNodeGuidelines();

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
    - large nodes (350px wide): agent, parallel-agent, prompt, sub-workflow
  - Horizontal spacing: place each subsequent column so there is at least 150px of empty gap between the right edge of the previous node and the left edge of the next one.
    Formula: next_x = prev_x + prev_node_width + 150.
    Examples: start (180px) at x:80 → next node at x:80+180+150 = x:410. agent (350px) at x:410 → next at x:410+350+150 = x:910. if-else (250px) at x:910 → next at x:910+250+150 = x:1310.
    IMPORTANT: When an agent has skill or document nodes, those sit to the LEFT of the agent (behind it). You must leave extra horizontal room so they don't overlap with the previous node. If an agent has skills/docs, increase the gap between the PREVIOUS node and the agent to at least 400px (i.e. next_x = prev_x + prev_node_width + 400). This accounts for the 180px skill/doc width + 60px gap + extra breathing room.
  - Start node at x:80, y:300.
  - Flow left-to-right. Calculate each column's x using the formula above.
  - Nodes in a straight sequential chain share the same y value.
  - BRANCHING: when an if-else, switch, or parallel-agent node fans out, the branching node stays on the main y line.
    The TRUE / first-branch target MUST have a SMALLER y (higher on screen) than the FALSE / later-branch targets.
    Space branch targets ~200px apart vertically, centered around the branching node's y.
    Example: if-else at y:300 → true-target at y:200, false-target at y:400.
    Example: switch at y:300 with 3 branches → targets at y:100, y:300, y:500.
  - When branches merge back (e.g. both branches → end), place the merge target at the branching node's y.
  - End node should be at the rightmost column, same y as start.

## Edge Rules
- Edge IDs: "e-<sourceId>-<targetId>"
- Normal flow: sourceHandle: "output", targetHandle: "input"
- Skill→Agent/ParallelAgent: sourceHandle: "skill-out", targetHandle: "skills" (skill nodes can ONLY connect to agent or parallel-agent nodes)
- Document→Agent/ParallelAgent: sourceHandle: "doc-out", targetHandle: "docs" (document nodes can ONLY connect to agent or parallel-agent nodes)

${nodeEdgeRules}

CRITICAL — EVERY branch output handle MUST be connected:
- Every if-else node MUST have BOTH "true" and "false" output handles connected to a target node. Never leave one dangling.
- Every switch node MUST have ALL branch labels connected to target nodes. If you define 3 branches, you need 3 outgoing edges.
- Every parallel-agent node MUST have its outputs fully connected. In fixed mode (default), ALL branch handles ("branch-0", "branch-1", ...) must be connected — if you define 3 branches, you need 3 outgoing edges. In dynamic spawn mode the parallel-agent node has EXACTLY ONE outgoing edge to ONE template Agent node — never emit branch-N handles in dynamic mode.
- Every ask-user node (in single-select mode) MUST have ALL option handles ("option-0", "option-1", ...) connected. If you define 3 options, you need 3 outgoing edges.
- No branching node output handle may be left unconnected. This is a hard requirement.

CRITICAL — PARALLEL-AGENT BRANCHES MUST TARGET AGENT NODES:
- Each branch of a parallel-agent node SPAWNS the \`agent\` node it's connected to. The connected agent IS the type/definition that gets cloned/spawned for that branch.
- Therefore every edge out of a parallel-agent ("branch-0", "branch-1", ... in fixed mode, or "output" in dynamic mode) MUST target a node whose \`type\` is exactly \`"agent"\`. It is INVALID for a branch to target prompt, script, sub-workflow, if-else, switch, ask-user, parallel-agent, handoff, end, skill, document, or mcp-tool.
- Never connect a parallel-agent branch to another parallel-agent — a parallel-agent cannot spawn another parallel-agent. If you need nested fan-out, connect each branch to an agent and let that agent drive further work.
- If you want different work per branch, create a distinct agent node per branch and wire each branch handle to its own agent. In dynamic mode, the single connected agent is the template cloned N times.

## Available Node Types

${nodeCatalogue}

## Understanding Skills and Documents

${relationshipSections}

## Node Data Templates

${nodeDataTemplates}

## Important Guidelines
- Generate meaningful labels, descriptions, and promptText content. Make it production-ready.
- Choose node types intentionally:
  - Use a single \`agent\` node when one delegated agent can handle the task alone.
  - Use a \`parallel-agent\` node when work can be done by multiple independent agents simultaneously, or when a large task should be split into parallel lanes handled at the same time.
  - Use a \`sub-workflow\` node when you need to group or reuse a multi-step flow, especially when the inner work is primarily sequential rather than parallel.
${nodeGuidelines}
- NEVER leave a branch output handle unconnected. Every if-else must have both true/false edges, every switch must have an edge per branch, every parallel-agent must have an edge per branch handle, and every ask-user (single-select) must have an edge per option.
- Skills and documents have a MANY-TO-MANY relationship with agent-like nodes: one agent or parallel-agent node can have multiple skills and documents, and one skill/document can be shared across multiple agents. Be generous — give each node the skills and documents it needs.
${modelsSection}${toolsSection}${contextSection}${editModeSection}
NOW OUTPUT ONLY JSON.`;
}

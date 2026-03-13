// ─── System Prompt Builder ───────────────────────────────────────────────────
// Constructs the full system prompt sent to the LLM for workflow generation.
// Includes the node catalogue, schema, rules, and contextual sections.

import { NODE_REGISTRY } from "@/lib/node-registry";

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
export function buildSystemPrompt(opts?: {
  projectContext?: string | null;
  availableModels?: string[];
  availableTools?: string[];
}): string {
  const { projectContext, availableModels, availableTools } = opts ?? {};
  const contextSection = projectContext
    ? `\n\n## Project Context\nThe user has a project with the following file structure. Use this to inform agent names, skill content, document references, and overall workflow design. Tailor the workflow to be relevant to this project:\n\`\`\`\n${projectContext}\n\`\`\`\n`
    : "";

  const modelsSection = availableModels && availableModels.length > 0
    ? `\n\n## Available Models\nThe following models are available for use in agent "model" fields. Use the full "provider/modelId" value. If you set model to "inherit", the agent inherits the parent's model.\nPrefer Claude (Anthropic) models as the default for most agents. Use lighter/cheaper models for simple tasks (e.g. summarisation, formatting) and more capable models for complex reasoning tasks.\n\nAvailable models:\n${availableModels.map((m) => `- ${m}`).join("\n")}\n`
    : "";

  const toolsSection = availableTools && availableTools.length > 0
    ? `\n\n## Available Tools\nThe following tools are available for agents. By default ALL tools are enabled. Only add tool names to the "disabledTools" array if you want to DISABLE specific tools for that agent. Only disable tools that are not relevant to the agent's task.\n\nAvailable tools: ${availableTools.join(", ")}\n`
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

CRITICAL — Parallel-agent node edges:
- Parallel-agent nodes spawn MULTIPLE runs of downstream external agent nodes at once.
- Their sourceHandle IDs are ALWAYS index-based: "branch-0", "branch-1", "branch-2", etc., matching the order of the \`branches\` array.
- You MUST create one outgoing edge per branch using those exact sourceHandle IDs.
- Each branch target should be an external \`agent\` node on the canvas.
- Branch targets must be stacked top-to-bottom matching branch order (branch-0 highest, last branch lowest).
- Parallel-agent nodes may also accept shared skill/document attachments exactly like normal agent nodes.
- Example: parallel-agent node "parallel-agent-abc" with 3 branches:
  {"id":"e-parallel-agent-abc-agent-a","source":"parallel-agent-abc","target":"agent-a","sourceHandle":"branch-0","targetHandle":"input"}
  {"id":"e-parallel-agent-abc-agent-b","source":"parallel-agent-abc","target":"agent-b","sourceHandle":"branch-1","targetHandle":"input"}
  {"id":"e-parallel-agent-abc-end-xyz","source":"parallel-agent-abc","target":"end-xyz","sourceHandle":"branch-2","targetHandle":"input"}

CRITICAL — Ask-user node edges:
- Ask-user nodes have TWO different modes that affect their output handles:

  MODE 1 — Single-select with manual options (multipleSelection: false AND aiSuggestOptions: false):
  - Each option gets its OWN output handle: "option-0", "option-1", "option-2", etc.
  - You MUST create one edge per option using "option-N" as the sourceHandle.
  - This means the ask-user node IS the branching node — each option branches directly to a different target.
  - Do NOT place a \`switch\` or \`if-else\` node immediately after a manual single-select ask-user node just to branch on the selected option. Connect the option edges directly to their downstream targets instead.
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

CRITICAL — EVERY branch output handle MUST be connected:
- Every if-else node MUST have BOTH "true" and "false" output handles connected to a target node. Never leave one dangling.
- Every switch node MUST have ALL branch labels connected to target nodes. If you define 3 branches, you need 3 outgoing edges.
- Every parallel-agent node MUST have ALL branch handles ("branch-0", "branch-1", ...) connected. If you define 3 branches, you need 3 outgoing edges.
- Every ask-user node (in single-select mode) MUST have ALL option handles ("option-0", "option-1", ...) connected. If you define 3 options, you need 3 outgoing edges.
- No branching node output handle may be left unconnected. This is a hard requirement.

## Available Node Types

${buildNodeCatalogue()}

## Understanding Skills and Documents

### Skills (type: "skill")
Skills are reusable knowledge/instruction units that get attached to agents. They represent specialised capabilities the agent should have. A skill node generates a \`.opencode/skills/<skillName>/SKILL.md\` file containing frontmatter (name, description, metadata) and the skill's instructions (promptText).

- **skillName**: A kebab-case slug used as the folder name (e.g. "code-review", "seo-optimization"). Must match [a-z0-9]+(-[a-z0-9]+)*.
- **description**: Explains what the skill does.
- **promptText**: The actual instructions/knowledge content for the skill. This should be detailed and production-ready.
- **metadata**: Optional key-value pairs (e.g. [{"key":"workflow","value":"github"}]).
- Skills connect ONLY to agent or parallel-agent nodes via: sourceHandle: "skill-out", targetHandle: "skills".
- An agent or parallel-agent node can have MULTIPLE skills connected to it — each skill adds a different capability. Create a separate skill node for each distinct capability and connect them all to the node.
- A skill node can be connected to MULTIPLE agents simultaneously — the same skill feeds capabilities to all connected agents. Create one edge per agent it connects to.
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
- Documents connect ONLY to agent or parallel-agent nodes via: sourceHandle: "doc-out", targetHandle: "docs".
- An agent or parallel-agent node can have MULTIPLE documents connected to it — each document provides different reference material. Create a separate document node for each distinct piece of context and connect them all to the node.
- A document node can be connected to MULTIPLE agents simultaneously — the same document provides context to all connected agents. Create one edge per agent it connects to.
- A document is NOT part of the main workflow flow — it sits beside its parent agent and feeds it context.
- Position document nodes BEHIND (to the LEFT of) their connected agent AND BELOW the agent's bottom edge.
  Use the same x column as skills: doc_x = agent_x - 180 - 40. doc_y = agent_y + agent_height + 30 (below agent baseline).
  If an agent has BOTH skills and documents, stack them in the same column behind the agent below the baseline: skills first, documents below, each with 16px vertical gap.

Generated document file template (\`.opencode/docs/<docName>.<ext>\`):
\`\`\`
<contentText content here - the actual document content>
\`\`\`

### How Skills and Documents Attach to Agents
The relationship is MANY-TO-MANY: one agent or parallel-agent node can have many skills and many documents, and one skill or document can be shared by many agents. When skills/documents are connected to an agent-like node, they appear in the generated agent file's frontmatter:
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

IMPORTANT — Referencing connected documents and skills in agent prompts:
When an agent has documents or skills connected to it, reference them by name in the agent's promptText using the \`{{name}}\` template syntax. This creates a static variable that auto-maps to the connected resource.
- For a document with docName "api-guide" and fileExtension "md", write \`{{api-guide}}\` in the agent's promptText where it needs that document's content.
- For a skill with skillName "code-review", write \`{{code-review}}\` in the agent's promptText where it needs that skill's instructions.
- The variable name inside \`{{}}\` must match the docName or skillName exactly (kebab-case).
- These variables MUST be listed in the agent's "detectedVariables" array.
- These variables MUST be mapped in the agent's "variableMappings" object:
  - For documents: \`"variableMappings": {"api-guide": "doc:api-guide.md"}\` (format: \`"doc:<docName>.<fileExtension>"\`)
  - For skills: \`"variableMappings": {"code-review": "skill:code-review"}\` (format: \`"skill:<skillName>"\`)
- COMPLETE EXAMPLE: An agent connected to document "api-guide" (md) and skill "code-review":
  \`\`\`
  {
    "promptText": "Review the code following the API standards in {{api-guide}} and ensure quality using {{code-review}} guidelines.",
    "detectedVariables": ["api-guide", "code-review"],
    "variableMappings": {"api-guide": "doc:api-guide.md", "code-review": "skill:code-review"}
  }
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
parallel-agent: {"type":"parallel-agent","label":"<label>","name":"<id>","sharedInstructions":"<instructions shared by all spawned agents>","branches":[{"label":"<branch label>","instructions":"<how this lane should use the connected external agent>","spawnCount":2},{"label":"<second branch label>","instructions":"<how this lane should use the connected external agent>","spawnCount":1}]}
  NOTE on parallel-agent:
  - This is a rectangular workflow node that spawns connected external agent nodes in parallel.
  - Prefer this node when multiple independent subtasks can run at the same time, or when a big task should be split across simultaneous agents.
  - \`branches\` MUST contain at least 2 entries.
  - Each branch creates its own output handle using \`branch-<index>\`.
  - Each branch should connect to an external \`agent\` node, and \`spawnCount\` defines how many parallel runs of that target agent to launch.
  - Branch \`instructions\` describe what that branch should ask the connected external agent to focus on.
  - \`sharedInstructions\` applies to every spawned branch run.
  - Shared skills/documents can connect to the parallel-agent node and are available to every branch.
prompt: {"type":"prompt","label":"<label>","name":"<id>","promptText":"<text>","detectedVariables":[]}
skill: {"type":"skill","label":"<label>","name":"<id>","skillName":"<kebab-case-name>","projectName":"","description":"<what this skill does>","promptText":"<detailed skill instructions and knowledge content>","detectedVariables":[],"metadata":[{"key":"workflow","value":"github"}]}
document: {"type":"document","label":"<label>","name":"<id>","docName":"<kebab-case-name>","contentMode":"inline","fileExtension":"md","contentText":"<actual document content - reference material, guides, data>","linkedFileName":"","linkedFileContent":"","description":"<what this document contains>"}
mcp-tool: {"type":"mcp-tool","label":"<label>","name":"<id>","toolName":"<name>","paramsText":""}
if-else: {"type":"if-else","label":"<label>","name":"<id>","evaluationTarget":"<target>","branches":[{"label":"If <cond>","condition":"<cond>"},{"label":"Else","condition":"else"}]}
switch: {"type":"switch","label":"<label>","name":"<id>","evaluationTarget":"<target>","branches":[{"label":"<case>","condition":"<cond>"}]}
ask-user: {"type":"ask-user","label":"<label>","name":"<id>","questionText":"<question>","multipleSelection":false,"aiSuggestOptions":false,"options":[{"label":"<option1>","description":"<desc1>"},{"label":"<option2>","description":"<desc2>"}]}
  NOTE: With multipleSelection:false and aiSuggestOptions:false (the default), each option becomes its own output handle (option-0, option-1, ...). Create one edge per option to branch the flow directly. Do not add a redundant switch or if-else right after this node. At least 2 options are required.
sub-workflow: {"type":"sub-workflow","label":"<label>","name":"<id>","mode":"same-context","subNodes":[],"subEdges":[],"nodeCount":0,"description":"","model":"inherit","memory":"default","temperature":0,"color":"#a855f7","disabledTools":[]}
  NOTE on sub-workflow:
  - mode can be "same-context" (runs inline, shares parent context) or "agent" (spawns a dedicated sub-agent). When mode is "agent", fill in description, model, memory, temperature, and color.
  - subNodes and subEdges define the INNER workflow of the sub-workflow. They follow the exact same node/edge schema as the top-level nodes/edges.
  - A sub-workflow MUST contain at least a start node and an end node inside subNodes, plus any other nodes (agents, prompts, if-else, etc.) that form the inner flow.
  - subEdges connect the inner nodes together, using the same format as top-level edges.
  - nodeCount should equal the number of subNodes.
  - Example with inner nodes: {"type":"sub-workflow","label":"Data Pipeline","name":"sub-wf-abc","mode":"agent","description":"Handles data ingestion","subNodes":[{"id":"start-inner","type":"start","position":{"x":0,"y":200},"data":{"type":"start","label":"Start","name":"start-inner"}},{"id":"agent-inner","type":"agent","position":{"x":400,"y":200},"data":{"type":"agent","label":"Process Data","name":"agent-inner","description":"Processes incoming data","promptText":"Process and validate the data...","detectedVariables":[],"model":"inherit","memory":"-","temperature":0,"color":"#5f27cd","disabledTools":[]}},{"id":"end-inner","type":"end","position":{"x":800,"y":200},"data":{"type":"end","label":"End","name":"end-inner"}}],"subEdges":[{"id":"e-start-agent","source":"start-inner","target":"agent-inner","type":"deletable"},{"id":"e-agent-end","source":"agent-inner","target":"end-inner","type":"deletable"}],"nodeCount":3,"model":"inherit","memory":"default","temperature":0,"color":"#a855f7","disabledTools":[]}

## Important Guidelines
- Generate meaningful labels, descriptions, and promptText content. Make it production-ready.
- Choose node types intentionally:
  - Use a single \`agent\` node when one delegated agent can handle the task alone.
  - Use a \`parallel-agent\` node when work can be done by multiple independent agents simultaneously, or when a large task should be split into parallel lanes handled at the same time.
  - Use a \`sub-workflow\` node when you need to group or reuse a multi-step flow, especially when the inner work is primarily sequential rather than parallel.
- When an agent needs specific capabilities, create skill nodes with detailed instructions and connect them.
- When an agent needs reference data, context, or guides, create document nodes with real content and connect them.
- Agent promptText should be comprehensive — write it as a real system prompt for an AI agent.
- Choose models wisely for each agent: use capable models (Claude Sonnet/Opus) for complex reasoning, coding, and analysis tasks; use lighter models (Claude Haiku, GPT-4o-mini) for simple formatting, summarisation, or routing tasks. Prefer Claude (Anthropic) models as the default when available.
- Only set temperature > 0 when creativity/variation is needed (e.g. content generation, brainstorming). Keep temperature at 0 for deterministic tasks (code review, analysis, routing).
- Only add tools to disabledTools when you specifically want to prevent an agent from using certain tools. Leave disabledTools empty to give the agent full access.
- Skill promptText should contain the actual skill instructions/knowledge (not just a placeholder).
- Document contentText should contain actual reference content (not just a placeholder).
- When connecting documents or skills to an agent, ALWAYS reference them in the agent's promptText using \`{{docName}}\` or \`{{skillName}}\` syntax, add those names to detectedVariables, and populate variableMappings with the correct \`"doc:<docName>.<ext>"\` or \`"skill:<skillName>"\` values.
- When a workflow section is complex or reusable, wrap it in a sub-workflow node with fully populated subNodes and subEdges. Use mode "same-context" for simple inline grouping, and mode "agent" when the sub-workflow should run as an independent agent with its own model and description.
- Sub-workflows must always contain at least a start and end node inside subNodes, with subEdges connecting the inner flow.
- Skills and documents have a MANY-TO-MANY relationship with agent-like nodes: one agent or parallel-agent node can have multiple skills and documents, and one skill/document can be shared across multiple agents. Be generous — give each node the skills and documents it needs.
- NEVER leave a branch output handle unconnected. Every if-else must have both true/false edges, every switch must have an edge per branch, every parallel-agent must have an edge per branch handle, and every ask-user (single-select) must have an edge per option.
- A manual single-select \`ask-user\` node already branches by option. Do not add a \`switch\` or \`if-else\` immediately after it unless you are branching later on a different piece of logic.
${modelsSection}${toolsSection}${contextSection}
NOW OUTPUT ONLY JSON.`;
}


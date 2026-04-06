import { Bot } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import { SubAgentModel, SubAgentMemory } from "./types";
import type { SubAgentNodeData } from "./types";

export const AGENT_TOOLS = [
  "bash", "edit", "write", "read", "grep", "glob",
  "list", "lsp", "patch", "skill", "todowrite", "todoread",
  "webfetch", "websearch", "question",
] as const;

export type AgentTool = (typeof AGENT_TOOLS)[number];

export const PRESET_COLORS = [
  "#5f27cd", "#ff6b6b", "#ff9f43", "#feca57", "#1dd1a1",
  "#48dbfb", "#54a0ff", "#ff6b81", "#a29bfe", "#fd79a8",
] as const;

export const subAgentRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.Agent,
  displayName: "Agent",
  description: "Delegate to an agent",
  icon: Bot,
  accentColor: "violet",
  accentHex: NODE_ACCENT.agent,
  category: NodeCategory.Basic,
  size: NodeSize.Large,
  defaultData: (): SubAgentNodeData => ({
    type: WorkflowNodeType.Agent,
    label: "Agent",
    name: "",
    description: "",
    promptText: "",
    detectedVariables: [],
    model: SubAgentModel.Inherit,
    memory: SubAgentMemory.Default,
    temperature: 0,
    color: NODE_ACCENT.agent,
    disabledTools: [],
    parameterMappings: [],
    variableMappings: {},
  }),
  aiGenerationPrompt: {
    description: "Delegate to an AI agent. Each agent node produces a `.opencode/agents/<agentName>.md` file. Write detailed, production-ready prompts.",
    dataTemplate: `{"type":"agent","label":"<label>","name":"<id>","description":"<desc>","promptText":"<detailed multi-line agent instructions>","detectedVariables":[],"model":"inherit","memory":"default","temperature":0,"color":"#5f27cd","disabledTools":[],"parameterMappings":[],"variableMappings":{}}`,
    requiredFields: [
      { field: "type", description: 'Must be "agent"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "description", description: "What the agent does" },
      { field: "promptText", description: "Comprehensive multi-paragraph system prompt telling the agent exactly what to do, edge cases, output format, etc." },
    ],
    optionalFields: [
      { field: "detectedVariables", description: "Array of variable names referenced in promptText via {{varName}} syntax", default: "[]" },
      { field: "model", description: 'Model ID or "inherit" to use parent model', default: '"inherit"' },
      { field: "memory", description: 'Memory mode: "default", "-" (none)', default: '"default"' },
      { field: "temperature", description: "0 for deterministic, >0 for creative tasks", default: "0" },
      { field: "color", description: "Hex color for the agent", default: '"#5f27cd"' },
      { field: "disabledTools", description: "Tool names to disable. Empty = all tools enabled", default: "[]" },
      { field: "variableMappings", description: 'Maps variable names to resources: "doc:<path>" or "skill:<name>"', default: "{}" },
    ],
    edgeRules: `Normal flow: sourceHandle "output", targetHandle "input".
Skills connect to agent via: sourceHandle "skill-out", targetHandle "skills".
Documents connect to agent via: sourceHandle "doc-out", targetHandle "docs".`,
    connectionRules: `Skills and documents have a MANY-TO-MANY relationship with agent nodes: one agent can have multiple skills and documents, and one skill/document can be shared across multiple agents.
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
  - <docSubfolder>/<docName2>.<ext>
color: "#5f27cd"
---

<agent promptText here>
\`\`\`

When connecting documents or skills to an agent, ALWAYS reference them in the agent's promptText using \`{{docName}}\` or \`{{skillName}}\` syntax, add those names to detectedVariables, and populate variableMappings with the correct \`"doc:<optionalSubfolder/><docName>.<ext>"\` or \`"skill:<skillName>"\` values.

COMPLETE EXAMPLE: An agent connected to document "api-guide" (md) and skill "code-review":
\`\`\`
{
  "promptText": "Review the code following the API standards in {{api-guide}} and ensure quality using {{code-review}} guidelines.",
  "detectedVariables": ["api-guide", "code-review"],
  "variableMappings": {"api-guide": "doc:product/api-guide.md", "code-review": "skill:code-review"}
}
\`\`\``,
    generationHints: [
      "Agent promptText should be comprehensive — write it as a real system prompt for an AI agent.",
      "Choose models wisely: use capable models (Claude Sonnet/Opus) for complex reasoning, coding, and analysis; use lighter models (Claude Haiku, GPT-4o-mini) for simple formatting, summarisation, or routing. Prefer Claude (Anthropic) models as default.",
      "Only set temperature > 0 when creativity/variation is needed (e.g. content generation, brainstorming). Keep temperature at 0 for deterministic tasks (code review, analysis, routing).",
      "Only add tools to disabledTools when you specifically want to prevent an agent from using certain tools. Leave disabledTools empty to give the agent full access.",
      "Use a single agent node when one delegated agent can handle the task alone.",
      "When an agent has skill or document nodes, those sit to the LEFT of the agent (behind it). Leave extra horizontal room so they don't overlap with the previous node. Increase the gap between the PREVIOUS node and the agent to at least 400px (next_x = prev_x + prev_node_width + 400).",
    ],
    examples: [
`Full agent file template (.opencode/agents/<name>.md):
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
\`\`\``,
    ],
  },
};

export const subAgentSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  description: z.string().default(""),
  promptText: z.string(),
  detectedVariables: z.array(z.string()).optional().default([]),
  model: z.string().default(SubAgentModel.Inherit),
  memory: z.enum(SubAgentMemory).default(SubAgentMemory.Default),
  temperature: z.number().min(0).max(1).default(0),
  color: z.string().default(NODE_ACCENT.agent),
  disabledTools: z.array(z.string()).default([]),
  parameterMappings: z.array(z.string()).default([]),
  variableMappings: z.record(z.string(), z.string()).default({}),
});


import { Wrench } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { SkillNodeData } from "./types";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const skillRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.Skill, displayName: "Skill", description: "A knowledge unit for subagent",
  icon: Wrench, accentColor: "cyan", accentHex: NODE_ACCENT.skill, category: NodeCategory.Basic,
  size: NodeSize.Medium,
  defaultData: (): SkillNodeData => ({
    type: WorkflowNodeType.Skill, label: "Skill", name: "", skillName: "",
    description: "", promptText: "", detectedVariables: [], variableMappings: {}, metadata: [],
    libraryRef: null,
  }),
  aiGenerationPrompt: {
    description: "Reusable knowledge/instruction unit that gets attached to agents. Skills represent specialised capabilities the agent should have. A skill node generates a `.opencode/skills/<skillName>/SKILL.md` file.",
    dataTemplate: `{"type":"skill","label":"<label>","name":"<id>","skillName":"<kebab-case-name>","description":"<what this skill does>","promptText":"<detailed skill instructions and knowledge content, optionally referencing connected scripts like {{lint-fix}}>","detectedVariables":[],"variableMappings":{},"metadata":[{"key":"language","value":"typescript"}]}`,
    edgeRules: `Skills connect ONLY to agent or parallel-agent nodes via: sourceHandle "skill-out", targetHandle "skills".
Script nodes connect to skills via: sourceHandle "script-out", targetHandle "scripts". A skill can have MULTIPLE connected scripts.`,
    requiredFields: [
      { field: "type", description: 'Must be "skill"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "skillName", description: 'Kebab-case slug used as folder name (e.g. "code-review", "seo-optimization"). Must match [a-z0-9]+(-[a-z0-9]+)*' },
      { field: "description", description: "What the skill does" },
      { field: "promptText", description: "The actual instructions/knowledge content for the skill. Should be detailed and production-ready." },
    ],
    optionalFields: [
      { field: "detectedVariables", description: "Variable names referenced in promptText", default: "[]" },
      { field: "variableMappings", description: 'Maps variable names to resources. Use "script:<scriptFileName>" for connected scripts', default: "{}" },
      { field: "metadata", description: 'Key-value pairs (e.g. [{"key":"workflow","value":"github"}])', default: "[]" },
    ],
    connectionRules: `Skills connect ONLY to agent or parallel-agent nodes via: sourceHandle "skill-out", targetHandle "skills".
An agent or parallel-agent node can have MULTIPLE skills — each skill adds a different capability. Create a separate skill node for each distinct capability.
A skill node can be connected to MULTIPLE agents simultaneously — the same skill feeds capabilities to all connected agents. Create one edge per agent it connects to.
A skill is NOT part of the main workflow flow — it sits beside its parent agent.
When a skill needs runnable helper code, create script nodes containing Bun-compatible script content and connect them to the skill using sourceHandle "script-out" and targetHandle "scripts".
Script nodes used by a skill should not be wired into the main start→end flow.`,
    generationHints: [
      "Position skill nodes BEHIND (to the LEFT of) their connected agent AND BELOW the agent's bottom edge. Formula: skill_x = agent_x - 180 - 40 (skill width + 40px gap). skill_y = agent_y + agent_height + 30 (30px below agent baseline). For an agent at x:410 y:240 (350x120): skill at x:190 y:390. If multiple skills, stack them vertically downward with 16px gap between them.",
      "Skill promptText should contain the actual skill instructions/knowledge (not just a placeholder).",
      "When a skill references connected scripts, add the `{{script-name}}` placeholders to `promptText`, include those names in `detectedVariables`, and populate `variableMappings` with `\"script:<scriptFileName>\"` values when known.",
      "In agent promptText, mention what each connected skill is for and when the agent should consult it using the exact `{{skillName}}` syntax.",
      "Prefer a skill node when the capability should be reusable, shared across multiple agents, or kept separate from the main agent prompt for clarity.",
      "When an agent needs specific capabilities, create skill nodes with detailed instructions and connect them.",
    ],
    examples: [
`Generated skill file template (.opencode/skills/<skillName>/SKILL.md):
\`\`\`
---
name: <skillName>
description: <description>
compatibility: opencode
metadata:
  workflow: github
---

<promptText content here - the actual skill instructions>

## Connected Scripts
- \`<scriptFileName>\` — generated from connected script node \`<scriptLabel>\`

## Script Variables
- \`{{script-name}}\` → \`scripts/<scriptFileName>\`
\`\`\``,
`Referencing connected scripts in skill prompts:
- Use \`{{script-name}}\` inside the skill's \`promptText\` when the skill should refer to that script.
- The variable name inside \`{{}}\` should match the connected script's exported base filename (derived from the script label, kebab-case, no extension).
- These variables MUST be listed in the skill's \`detectedVariables\` array.
- These variables SHOULD be mapped in the skill's \`variableMappings\` object as \`"script:<scriptFileName>"\`.`,
    ],
  },
};

export const skillSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  skillName: z.string(),
  description: z.string().default(""),
  promptText: z.string().default(""),
  detectedVariables: z.array(z.string()).default([]),
  variableMappings: z.record(z.string(), z.string()).default({}),
  metadata: z
    .array(
      z.object({
        key: z.string().refine(
          (v) => v.trim() === "" || SLUG_REGEX.test(v.trim()),
          { message: "Must match [a-z0-9]+(-[a-z0-9]+)*" }
        ),
        value: z.string().refine(
          (v) => v.trim() === "" || SLUG_REGEX.test(v.trim()),
          { message: "Must match [a-z0-9]+(-[a-z0-9]+)*" }
        ),
      })
    )
    .default([]),
  libraryRef: z
    .object({
      scope: z.enum(["workspace", "user"]),
      packId: z.string(),
      packKey: z.string().optional(),
      packVersion: z.string(),
      skillId: z.string(),
      skillKey: z.string().optional(),
      skillName: z.string().optional(),
    })
    .nullable()
    .default(null),
});

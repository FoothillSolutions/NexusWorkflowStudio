import { Bot } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
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
  type: "agent",
  displayName: "Agent",
  description: "Delegate to an agent",
  icon: Bot,
  accentColor: "violet",
  accentHex: NODE_ACCENT.agent,
  category: NodeCategory.Basic,
  size: NodeSize.Large,
  defaultData: (): SubAgentNodeData => ({
    type: "agent",
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


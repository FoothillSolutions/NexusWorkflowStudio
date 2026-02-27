import { Bot } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
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
  accentHex: "#5f27cd",
  category: NodeCategory.Basic,
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
    color: "#5f27cd",
    disabledTools: [],
    parameterMappings: [],
  }),
};

export const subAgentSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  description: z.string().default(""),
  promptText: z.string(),
  detectedVariables: z.array(z.string()).optional().default([]),
  model: z.nativeEnum(SubAgentModel).default(SubAgentModel.Inherit),
  memory: z.nativeEnum(SubAgentMemory).default(SubAgentMemory.Default),
  temperature: z.number().min(0).max(1).default(0),
  color: z.string().default("#5f27cd"),
  disabledTools: z.array(z.string()).default([]),
  parameterMappings: z.array(z.string()).default([]),
});


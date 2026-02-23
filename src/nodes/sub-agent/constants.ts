import { Bot } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { SubAgentModel, SubAgentMemory } from "./types";
import type { SubAgentNodeData } from "./types";
export const subAgentRegistryEntry: NodeRegistryEntry = {
  type: "sub-agent",
  displayName: "Sub-Agent",
  description: "Delegate to an agent",
  icon: Bot,
  accentColor: "violet",
  accentHex: "#8b5cf6",
  category: NodeCategory.Basic,
  defaultData: (): SubAgentNodeData => ({
    type: "sub-agent",
    label: "Sub-Agent",
    name: "",
    promptText: "",
    detectedVariables: [],
    model: SubAgentModel.Inherit,
    memory: SubAgentMemory.Default,
    tools: "",
  }),
};
export const subAgentSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  promptText: z.string(),
  detectedVariables: z.array(z.string()).optional().default([]),
  model: z.nativeEnum(SubAgentModel).default(SubAgentModel.Inherit),
  memory: z.nativeEnum(SubAgentMemory).default(SubAgentMemory.Default),
  tools: z.string().default(""),
});
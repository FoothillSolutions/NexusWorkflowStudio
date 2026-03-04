import { GitBranch } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/base-node";
import { NODE_ACCENT } from "@/lib/node-colors";
import { SubAgentModel, SubAgentMemory } from "@/nodes/sub-agent/enums";
import type { SubWorkflowNodeData } from "./types";

export const subWorkflowRegistryEntry: NodeRegistryEntry = {
  type: "sub-workflow",
  displayName: "Sub Workflow",
  description: "Embed a sub-workflow",
  icon: GitBranch,
  accentColor: "purple",
  accentHex: NODE_ACCENT["sub-workflow"],
  category: NodeCategory.Basic,
  size: NodeSize.Large,
  defaultData: (): SubWorkflowNodeData => ({
    type: "sub-workflow",
    label: "Sub Workflow",
    name: "",
    mode: "same-context",
    subNodes: [],
    subEdges: [],
    nodeCount: 0,
    description: "",
    model: SubAgentModel.Inherit,
    memory: SubAgentMemory.Default,
    temperature: 0,
    color: NODE_ACCENT["sub-workflow"],
    disabledTools: [],
  }),
};

export const subWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  mode: z.enum(["same-context", "agent"]).default("same-context"),
  subNodes: z.array(z.any()).default([]),
  subEdges: z.array(z.any()).default([]),
  nodeCount: z.coerce.number().int().min(0),
  // Agent-mode fields
  description: z.string().default(""),
  model: z.string().default(SubAgentModel.Inherit),
  memory: z.enum(SubAgentMemory).default(SubAgentMemory.Default),
  temperature: z.number().min(0).max(1).default(0),
  color: z.string().default(NODE_ACCENT["sub-workflow"]),
  disabledTools: z.array(z.string()).default([]),
});


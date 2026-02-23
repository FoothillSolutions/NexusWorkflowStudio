import { GitBranch } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { SubAgentFlowNodeData } from "./types";
export const subAgentFlowRegistryEntry: NodeRegistryEntry = {
  type: "sub-agent-flow",
  displayName: "Sub-Agent Flow",
  description: "Reference another flow",
  icon: GitBranch,
  accentColor: "purple",
  accentHex: "#a855f7",
  category: NodeCategory.Basic,
  defaultData: (): SubAgentFlowNodeData => ({ type: "sub-agent-flow", label: "Sub-Agent Flow", name: "", flowRef: "", nodeCount: 0 }),
};
export const subAgentFlowSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  flowRef: z.string(),
  nodeCount: z.coerce.number().int().min(0),
});
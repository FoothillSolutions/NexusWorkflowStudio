import { Square } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { EndNodeData } from "./types";
export const endRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.End,
  displayName: "END",
  description: "Terminal node",
  icon: Square,
  accentColor: "red",
  accentHex: NODE_ACCENT.end,
  category: NodeCategory.ControlFlow,
  defaultData: (): EndNodeData => ({ type: WorkflowNodeType.End, label: "END", name: "" }),
};
export const endSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
});

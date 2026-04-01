import { GitFork } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { IfElseNodeData } from "./types";

export const ifElseRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.IfElse,
  displayName: "If / Else",
  description: "Conditional branch",
  icon: GitFork,
  accentColor: "amber",
  accentHex: NODE_ACCENT["if-else"],
  category: NodeCategory.ControlFlow,
  defaultData: (): IfElseNodeData => ({
    type: WorkflowNodeType.IfElse,
    label: "If / Else",
    name: "",
    evaluationTarget: "",
    branches: [
      { label: "True", condition: "" },
      { label: "False", condition: "" },
    ],
  }),
};

export const ifElseBranchSchema = z.object({
  label: z.string().min(1, "Branch label is required"),
  condition: z.string(),
});

export const ifElseSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  evaluationTarget: z.string(),
  branches: z.array(ifElseBranchSchema).length(2, "Exactly two branches are required"),
});

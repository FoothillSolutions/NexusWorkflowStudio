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
  aiGenerationPrompt: {
    description: "Conditional branch with exactly 2 outputs: true and false.",
    dataTemplate: `{"type":"if-else","label":"<label>","name":"<id>","evaluationTarget":"<target>","branches":[{"label":"If <cond>","condition":"<cond>"},{"label":"Else","condition":"else"}]}`,
    edgeRules: `CRITICAL — If-else node edges:
If-else nodes have exactly 2 branches. The sourceHandle IDs are ALWAYS "true" for the first branch and "false" for the second branch.
You MUST create one edge per branch from the if-else node using these exact sourceHandle values.
The "true" branch target must be positioned ABOVE the "false" branch target (lower y value).
Example: if-else node "if-else-abc" at y:300 connecting to "agent-yes" at y:200 (first/true branch) and "agent-no" at y:400 (second/false branch):
  {"id":"e-if-else-abc-agent-yes","source":"if-else-abc","target":"agent-yes","sourceHandle":"true","targetHandle":"input"}
  {"id":"e-if-else-abc-agent-no","source":"if-else-abc","target":"agent-no","sourceHandle":"false","targetHandle":"input"}`,
    requiredFields: [
      { field: "type", description: 'Must be "if-else"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "evaluationTarget", description: "What to evaluate" },
      { field: "branches", description: 'Exactly 2 branches: first with condition, second with condition "else"' },
    ],
    generationHints: [
      "Every if-else node MUST have BOTH \"true\" and \"false\" output handles connected to a target node. Never leave one dangling.",
      "The TRUE target MUST have a SMALLER y (higher on screen) than the FALSE target. Example: if-else at y:300 → true-target at y:200, false-target at y:400.",
    ],
  },
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

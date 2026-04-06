import { ArrowRightLeft } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { SwitchNodeData } from "./types";
import { createDefaultSwitchBranches } from "./branches";

export const switchRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.Switch,
  displayName: "Switch",
  description: "Multi-way branch",
  icon: ArrowRightLeft,
  accentColor: "orange",
  accentHex: NODE_ACCENT.switch,
  category: NodeCategory.ControlFlow,
  defaultData: (): SwitchNodeData => ({
    type: WorkflowNodeType.Switch,
    label: "Switch",
    name: "",
    evaluationTarget: "",
    branches: createDefaultSwitchBranches(),
  }),
  aiGenerationPrompt: {
    description: "Multi-way branching node with N output handles.",
    dataTemplate: `{"type":"switch","label":"<label>","name":"<id>","evaluationTarget":"<target>","branches":[{"label":"<case>","condition":"<cond>"}]}`,
    edgeRules: `CRITICAL — Switch node edges:
Switch node sourceHandle IDs should follow branch order: "branch-0", "branch-1", "branch-2", etc.
You MUST create one edge per branch using the matching "branch-N" sourceHandle for that branch index.
Branch targets must be stacked top-to-bottom matching branch order (first branch = smallest y, last branch = largest y).
Example: switch node "switch-abc" at y:300 with 3 branches:
  {"id":"e-switch-abc-agent-a","source":"switch-abc","target":"agent-a","sourceHandle":"branch-0","targetHandle":"input"}  (agent-a at y:120)
  {"id":"e-switch-abc-agent-b","source":"switch-abc","target":"agent-b","sourceHandle":"branch-1","targetHandle":"input"}  (agent-b at y:300)
  {"id":"e-switch-abc-end-xyz","source":"switch-abc","target":"end-xyz","sourceHandle":"branch-2","targetHandle":"input"}  (end-xyz at y:480)`,
    requiredFields: [
      { field: "type", description: 'Must be "switch"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "evaluationTarget", description: "What to evaluate" },
      { field: "branches", description: "Array of branch objects with label and condition" },
    ],
    generationHints: [
      "Every switch node MUST have ALL branch labels connected to target nodes. If you define 3 branches, you need 3 outgoing edges.",
      "Branch targets stacked top-to-bottom: first branch = smallest y. Example: switch at y:300 with 3 branches → targets at y:100, y:300, y:500.",
    ],
  },
};

export const switchBranchSchema = z.object({
  label: z.string().min(1, "Branch label is required"),
  condition: z.string(),
});

export const switchSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  evaluationTarget: z.string(),
  branches: z.array(switchBranchSchema).min(2, "At least 1 branch plus default are required"),
});

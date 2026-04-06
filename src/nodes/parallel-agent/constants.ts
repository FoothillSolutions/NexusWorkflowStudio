import { Network } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { ParallelAgentBranch, ParallelAgentNodeData } from "./types";

export function createParallelAgentBranch(index: number): ParallelAgentBranch {
  const n = index + 1;
  return {
    label: `Branch ${n}`,
    instructions: "",
    spawnCount: 1,
  };
}

export const parallelAgentRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.ParallelAgent,
  displayName: "Parallel Agent",
  description: "Split work across simultaneous external agents",
  icon: Network,
  accentColor: "indigo",
  accentHex: NODE_ACCENT["parallel-agent"],
  category: NodeCategory.ControlFlow,
  size: NodeSize.Large,
  defaultData: (): ParallelAgentNodeData => ({
    type: WorkflowNodeType.ParallelAgent,
    label: "Parallel Agent",
    name: "",
    sharedInstructions: "",
    branches: [createParallelAgentBranch(0), createParallelAgentBranch(1)],
  }),
  aiGenerationPrompt: {
    description: "A rectangular workflow node that spawns connected external agent nodes in parallel. Prefer this node when multiple independent subtasks can run at the same time, or when a big task should be split across simultaneous agents.",
    dataTemplate: `{"type":"parallel-agent","label":"<label>","name":"<id>","sharedInstructions":"<instructions shared by all spawned agents>","branches":[{"label":"<branch label>","instructions":"<how this lane should use the connected external agent>","spawnCount":1}]}`,
    edgeRules: `Parallel-agent node sourceHandle IDs are ALWAYS index-based: "branch-0", "branch-1", "branch-2", etc., matching the order of the \`branches\` array.
You MUST create one outgoing edge per branch using those exact sourceHandle IDs.
Each branch target should be an external \`agent\` node on the canvas.
Branch targets must be stacked top-to-bottom matching branch order (branch-0 highest, last branch lowest).
Parallel-agent nodes may also accept shared skill/document attachments exactly like normal agent nodes.
Example: parallel-agent node "parallel-agent-abc" with 3 branches:
  {"id":"e-parallel-agent-abc-agent-a","source":"parallel-agent-abc","target":"agent-a","sourceHandle":"branch-0","targetHandle":"input"}
  {"id":"e-parallel-agent-abc-agent-b","source":"parallel-agent-abc","target":"agent-b","sourceHandle":"branch-1","targetHandle":"input"}
  {"id":"e-parallel-agent-abc-end-xyz","source":"parallel-agent-abc","target":"end-xyz","sourceHandle":"branch-2","targetHandle":"input"}`,
    requiredFields: [
      { field: "type", description: 'Must be "parallel-agent"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "branches", description: "Array with at least 1 entry. Each branch creates output handle branch-<index>" },
    ],
    optionalFields: [
      { field: "sharedInstructions", description: "Instructions that apply to every spawned branch run", default: '""' },
    ],
    connectionRules: `Skills and documents connect to parallel-agent nodes the same way as regular agent nodes (sourceHandle "skill-out"/"doc-out", targetHandle "skills"/"docs"). Shared skills/documents are available to every branch.`,
    generationHints: [
      "Each branch's `instructions` describe what that branch should ask the connected external agent to focus on.",
      "`spawnCount` defines how many parallel runs of that target agent to launch per branch.",
      "`sharedInstructions` applies to every spawned branch run.",
      "Every parallel-agent node MUST have ALL branch handles connected. If you define 3 branches, you need 3 outgoing edges.",
    ],
  },
};

export const parallelAgentBranchSchema = z.object({
  label: z.string().min(1, "Branch label is required"),
  instructions: z.string().default(""),
  spawnCount: z.coerce.number().int().min(1, "Spawn count must be at least 1").default(1),
});

export const parallelAgentSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  sharedInstructions: z.string().default(""),
  branches: z.array(parallelAgentBranchSchema).min(1, "At least 1 branch is required"),
});


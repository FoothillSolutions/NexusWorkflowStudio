import { Network } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
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
  type: "parallel-agent",
  displayName: "Parallel Agent",
  description: "Split work across simultaneous external agents",
  icon: Network,
  accentColor: "indigo",
  accentHex: NODE_ACCENT["parallel-agent"],
  category: NodeCategory.ControlFlow,
  size: NodeSize.Large,
  defaultData: (): ParallelAgentNodeData => ({
    type: "parallel-agent",
    label: "Parallel Agent",
    name: "",
    sharedInstructions: "",
    branches: [createParallelAgentBranch(0), createParallelAgentBranch(1)],
  }),
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


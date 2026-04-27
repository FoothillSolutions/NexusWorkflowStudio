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
    spawnMode: "fixed",
    sharedInstructions: "",
    branches: [createParallelAgentBranch(0), createParallelAgentBranch(1)],
    spawnCriterion: "",
    spawnMin: 1,
    spawnMax: 1,
  }),
  aiGenerationPrompt: {
    description: `A rectangular workflow node that spawns connected external agent nodes in parallel. Supports two modes: "fixed" (a hand-authored list of branches, each wired to its own agent) and "dynamic" (a single template agent fanned out N times at runtime). Prefer this node when multiple independent subtasks can run simultaneously, or when a big task should be split across parallel agents.`,
    dataTemplate: `{"type":"parallel-agent","label":"<label>","name":"<id>","spawnMode":"fixed","sharedInstructions":"<instructions shared by all spawned agents>","branches":[{"label":"<branch label>","instructions":"<how THIS branch should drive its connected agent — branch instructions live on the branch object, NOT on the agent>","spawnCount":1}],"spawnCriterion":"","spawnMin":1,"spawnMax":1}

// dynamic variant (criterion + min/max bounds, single template agent):
{"type":"parallel-agent","label":"<label>","name":"<id>","spawnMode":"dynamic","sharedInstructions":"<instructions shared by every cloned agent>","branches":[],"spawnCriterion":"one agent per detected topic","spawnMin":1,"spawnMax":5}`,
    edgeRules: `Parallel-agent node edge handles depend on \`spawnMode\`:

FIXED MODE (\`spawnMode: "fixed"\`) — sourceHandle IDs are index-based: "branch-0", "branch-1", "branch-2", etc., matching the order of the \`branches\` array.
- You MUST create one outgoing edge per branch using those exact sourceHandle IDs.
- Each branch target MUST be an external \`agent\` node on the canvas.
- Every branch handle MUST be connected to exactly one agent. No branch handle may be left dangling.
- Branch targets should be stacked top-to-bottom matching branch order (branch-0 highest, last branch lowest).
- The branch's \`instructions\` field describes what THAT branch asks the connected agent to focus on. branch instructions live on the branch object. DO NOT copy the branch instruction into the agent's promptText. The agent's \`promptText\` is its own role; the branch \`instructions\` is an upstream descriptor the runtime surfaces to the agent.

DYNAMIC MODE (\`spawnMode: "dynamic"\`) — the node exposes a single output handle, sourceHandle \`"output"\`, targetHandle \`"input"\`.
- In dynamic spawn mode the parallel-agent node has EXACTLY ONE outgoing edge to ONE template Agent node — never emit branch-N handles in dynamic mode.
- The single outgoing edge MUST target an \`agent\` node (the "template" agent cloned at runtime).
- NEVER emit additional outgoing edges from the parallel-agent in dynamic mode. There is exactly one template.
- Leave \`branches\` as an empty array \`[]\`.
- \`spawnCriterion\` is REQUIRED and non-empty — describes the runtime rule for deriving N.
- \`spawnMin\` and \`spawnMax\` bound the number of spawned instances at runtime. \`spawnMin >= 1\`, \`spawnMax >= spawnMin\`.

Example (fixed, 3 branches):
  {"id":"e-parallel-agent-abc-agent-a","source":"parallel-agent-abc","target":"agent-a","sourceHandle":"branch-0","targetHandle":"input"}
  {"id":"e-parallel-agent-abc-agent-b","source":"parallel-agent-abc","target":"agent-b","sourceHandle":"branch-1","targetHandle":"input"}
  {"id":"e-parallel-agent-abc-agent-c","source":"parallel-agent-abc","target":"agent-c","sourceHandle":"branch-2","targetHandle":"input"}

Example (dynamic, single template agent):
  {"id":"e-parallel-agent-def-agent-t","source":"parallel-agent-def","target":"agent-template","sourceHandle":"output","targetHandle":"input"}

Parallel-agent nodes also accept shared skill/document attachments in both modes exactly like normal agent nodes.`,
    requiredFields: [
      { field: "type", description: 'Must be "parallel-agent"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "spawnMode", description: '"fixed" (hand-authored branches) or "dynamic" (single template agent fanned out at runtime).' },
      { field: "branches", description: "Fixed mode: array with at least 1 entry. Each branch creates output handle branch-<index>. Dynamic mode: MUST be an empty array []." },
      { field: "spawnCriterion", description: 'Dynamic mode: REQUIRED non-empty string describing the runtime rule (e.g. "one agent per input topic"). Fixed mode: MUST be empty string "".' },
      { field: "spawnMin", description: "Dynamic mode: integer >= 1 — minimum spawn count. Fixed mode: MUST be 1." },
      { field: "spawnMax", description: "Dynamic mode: integer >= spawnMin — maximum spawn count. Fixed mode: MUST be 1." },
    ],
    optionalFields: [
      { field: "sharedInstructions", description: "Instructions that apply to every spawned agent run in both modes", default: '""' },
    ],
    connectionRules: `Skills and documents connect to parallel-agent nodes the same way as regular agent nodes (sourceHandle "skill-out"/"doc-out", targetHandle "skills"/"docs"). Shared skills/documents are available to every spawned agent in both fixed and dynamic modes.

BRANCH INSTRUCTION BELONGS TO THE BRANCH, NOT THE AGENT: in fixed mode, branch instructions live on the branch object. Do not duplicate the branch's \`instructions\` field into the target agent's \`promptText\`. The agent's \`promptText\` should describe its own role generically, and the runtime passes the branch instruction to the agent per invocation. DO NOT copy the branch instruction into the agent's promptText.

In dynamic mode, remember: the parallel-agent has exactly one outgoing edge to exactly one Agent template. Do NOT split dynamic-mode fan-out into multiple template agents.`,
    generationHints: [
      "spawnMode discriminates behavior. Default to \"fixed\" unless the user clearly wants runtime fan-out.",
      "FIXED MODE: each branch's `instructions` describes what that branch should ask the connected external agent to focus on. branch instructions live on the branch object, NOT on the target agent's promptText.",
      "FIXED MODE: `spawnCount` on each branch defines how many parallel runs of that target agent to launch per branch.",
      "DYNAMIC MODE: use when N is determined at runtime (e.g. one agent per detected topic, one per input item).",
      "In dynamic spawn mode the parallel-agent node has EXACTLY ONE outgoing edge to ONE template Agent node — never emit branch-N handles in dynamic mode.",
      "DYNAMIC MODE: always set `spawnCriterion` to a non-empty string describing the runtime rule.",
      "DYNAMIC MODE: set `spawnMin >= 1` and `spawnMax >= spawnMin`. Use `spawnMin == spawnMax` when the count is known to be fixed at runtime.",
      "DYNAMIC MODE: `branches` MUST be an empty array; never create branch-N edges in dynamic mode.",
      "`sharedInstructions` applies to every spawned agent run in both modes.",
      "Every parallel-agent node MUST have its output handle(s) connected: fixed mode = one edge per branch, dynamic mode = exactly one edge to one agent.",
      "DO NOT copy the branch instruction into the agent's promptText. The branch instruction is a per-lane descriptor; the agent's promptText is its role definition.",
    ],
    examples: [
`Example (fixed mode, 2 branches):
{"type":"parallel-agent","label":"Research Pair","name":"parallel-research-xy","spawnMode":"fixed","sharedInstructions":"Collect findings into a shared report","branches":[{"label":"Competitor scan","instructions":"Scan top 3 competitor products for feature gaps","spawnCount":1},{"label":"Customer scan","instructions":"Interview 5 customers about pain points","spawnCount":1}],"spawnCriterion":"","spawnMin":1,"spawnMax":1}`,
`Example (dynamic mode, bounded criterion):
{"type":"parallel-agent","label":"Topic Summarizers","name":"parallel-summ-ab","spawnMode":"dynamic","sharedInstructions":"Each agent summarizes one topic from the input","branches":[],"spawnCriterion":"one agent per detected topic","spawnMin":1,"spawnMax":6}`,
`Example (dynamic mode, exact count via min==max):
{"type":"parallel-agent","label":"Per-Item Processors","name":"parallel-proc-cd","spawnMode":"dynamic","sharedInstructions":"Process one input item each","branches":[],"spawnCriterion":"one agent per item in the input list","spawnMin":3,"spawnMax":3}`,
    ],
  },
};

export const parallelAgentBranchSchema = z.object({
  label: z.string().min(1, "Branch label is required"),
  instructions: z.string().default(""),
  spawnCount: z.coerce.number().int().min(1, "Spawn count must be at least 1").default(1),
});

export const parallelAgentSchema = z.preprocess(
  (raw) => {
    if (raw == null || typeof raw !== "object") return raw;
    const data = { ...(raw as Record<string, unknown>) };
    // Legacy spawnCount (from just-landed feature) → map into spawnMin/spawnMax.
    if (typeof data.spawnCount === "number" && data.spawnCount >= 1) {
      if (data.spawnMin === undefined) data.spawnMin = data.spawnCount;
      if (data.spawnMax === undefined) data.spawnMax = data.spawnCount;
    }
    // Null or missing spawnCriterion → empty string.
    if (data.spawnCriterion === null || data.spawnCriterion === undefined) {
      data.spawnCriterion = "";
    }
    // Drop the obsolete field so superRefine sees the new shape only.
    delete data.spawnCount;
    return data;
  },
  z.object({
    name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
    label: z.string().min(1, "Label is required"),
    spawnMode: z.enum(["fixed", "dynamic"]).default("fixed"),
    sharedInstructions: z.string().default(""),
    branches: z.array(parallelAgentBranchSchema).default([]),
    spawnCriterion: z.string().default(""),
    spawnMin: z.coerce.number().int().min(1, "Min must be at least 1").default(1),
    spawnMax: z.coerce.number().int().min(1, "Max must be at least 1").default(1),
  }).superRefine((data, ctx) => {
    if (data.spawnMode === "fixed") {
      if (data.branches.length < 1) {
        ctx.addIssue({ code: "custom", path: ["branches"], message: "At least 1 branch is required in fixed mode" });
      }
      if (data.spawnCriterion.trim().length > 0) {
        ctx.addIssue({ code: "custom", path: ["spawnCriterion"], message: "spawnCriterion must be empty in fixed mode" });
      }
      if (data.spawnMin !== 1) {
        ctx.addIssue({ code: "custom", path: ["spawnMin"], message: "spawnMin must be 1 in fixed mode" });
      }
      if (data.spawnMax !== 1) {
        ctx.addIssue({ code: "custom", path: ["spawnMax"], message: "spawnMax must be 1 in fixed mode" });
      }
    } else {
      if (data.spawnCriterion.trim().length < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["spawnCriterion"],
          message: "Spawn criterion is required in dynamic mode",
        });
      }
      if (data.spawnMin < 1) {
        ctx.addIssue({ code: "custom", path: ["spawnMin"], message: "spawnMin must be at least 1" });
      }
      if (data.spawnMax < data.spawnMin) {
        ctx.addIssue({ code: "custom", path: ["spawnMax"], message: "spawnMax must be >= spawnMin" });
      }
    }
  }),
);


// ─── Edge Handle Fixer ───────────────────────────────────────────────────────
// Normalises sourceHandles on edges coming from if-else, switch, ask-user,
// and parallel-agent nodes.
// nodes. The LLM sometimes uses "branch-N" instead of the expected handle IDs.

import { WorkflowNodeType, type NodeType } from "@/types/workflow";
import type { WorkflowEdge } from "@/types/workflow";
import { findSwitchBranchIndexByHandle, getSwitchBranchHandleId } from "@/nodes/switch/branches";

/** Branch index used for the truthy output of an if/else node. */
const IF_ELSE_TRUE_BRANCH_INDEX = 0;

/** Branch index used for the falsy output of an if/else node. */
const IF_ELSE_FALSE_BRANCH_INDEX = 1;

/** Base-10 radix used when converting numeric handle suffixes to integers. */
const DECIMAL_RADIX = 10;

/** Node metadata needed for edge handle fixing. */
export interface NodeBranchInfo {
  type: NodeType;
  branches?: Array<{ id?: string; label: string }>;
  options?: Array<{ label: string }>;
  multipleSelection?: boolean;
  aiSuggestOptions?: boolean;
  /** Parallel-agent only: discriminates fixed vs dynamic spawn mode. */
  spawnMode?: "fixed" | "dynamic";
}

/** Fix if-else / switch / ask-user / parallel-agent sourceHandles on a set of edges using node type info. */
export function fixEdgeHandles(
  edges: Array<Record<string, unknown>>,
  nodeTypeMap: Map<string, NodeBranchInfo>,
): WorkflowEdge[] {
  return edges.map((edge) => {
    const sourceInfo = nodeTypeMap.get(edge.source as string);
    if (!sourceInfo) return { ...edge, type: "deletable" } as unknown as WorkflowEdge;

    const handle = edge.sourceHandle as string | undefined;

    if (sourceInfo.type === WorkflowNodeType.IfElse) {
      if (handle === `branch-${IF_ELSE_TRUE_BRANCH_INDEX}` || handle === `${IF_ELSE_TRUE_BRANCH_INDEX}`) {
        return { ...edge, sourceHandle: "true", type: "deletable" } as unknown as WorkflowEdge;
      }
      if (handle === `branch-${IF_ELSE_FALSE_BRANCH_INDEX}` || handle === `${IF_ELSE_FALSE_BRANCH_INDEX}`) {
        return { ...edge, sourceHandle: "false", type: "deletable" } as unknown as WorkflowEdge;
      }
    }

    if (sourceInfo.type === WorkflowNodeType.Switch && sourceInfo.branches) {
      const switchBranches = sourceInfo.branches as Array<{ id?: string; label: string }>;
      const idx = findSwitchBranchIndexByHandle(switchBranches, handle);
      if (idx !== -1) {
        return {
          ...edge,
          sourceHandle: getSwitchBranchHandleId(switchBranches[idx], idx, switchBranches.length),
          type: "deletable",
        } as unknown as WorkflowEdge;
      }
    }

    if (sourceInfo.type === WorkflowNodeType.ParallelAgent) {
      if (sourceInfo.spawnMode === "dynamic") {
        return { ...edge, sourceHandle: "output", type: "deletable" } as unknown as WorkflowEdge;
      }
      if (sourceInfo.branches) {
        const branchMatch = handle?.match(/^branch-(\d+)$/);
        if (branchMatch) {
          const idx = Number.parseInt(branchMatch[1], DECIMAL_RADIX);
          if (idx < sourceInfo.branches.length) {
            return { ...edge, sourceHandle: `branch-${idx}`, type: "deletable" } as unknown as WorkflowEdge;
          }
        }
      }
    }

    // Fix ask-user: when single-select (not multi, not AI), handles are "option-N"
    // LLM might use "branch-N" instead
    if (sourceInfo.type === WorkflowNodeType.AskUser && !sourceInfo.multipleSelection && !sourceInfo.aiSuggestOptions) {
      const branchMatch = handle?.match(/^branch-(\d+)$/);
      if (branchMatch) {
        return { ...edge, sourceHandle: `option-${branchMatch[1]}`, type: "deletable" } as unknown as WorkflowEdge;
      }
    }

    return { ...edge, type: "deletable" } as unknown as WorkflowEdge;
  });
}


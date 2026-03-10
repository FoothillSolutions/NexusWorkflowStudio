// ─── Edge Handle Fixer ───────────────────────────────────────────────────────
// Normalises sourceHandles on edges coming from if-else, switch, and ask-user
// nodes. The LLM sometimes uses "branch-N" instead of the expected handle IDs.

import type { WorkflowEdge } from "@/types/workflow";

/** Node metadata needed for edge handle fixing. */
export interface NodeBranchInfo {
  type: string;
  branches?: Array<{ label: string }>;
  options?: Array<{ label: string }>;
  multipleSelection?: boolean;
  aiSuggestOptions?: boolean;
}

/** Fix if-else / switch / ask-user sourceHandles on a set of edges using node type info. */
export function fixEdgeHandles(
  edges: Array<Record<string, unknown>>,
  nodeTypeMap: Map<string, NodeBranchInfo>,
): WorkflowEdge[] {
  return edges.map((edge) => {
    const sourceInfo = nodeTypeMap.get(edge.source as string);
    if (!sourceInfo) return { ...edge, type: "deletable" } as unknown as WorkflowEdge;

    const handle = edge.sourceHandle as string | undefined;

    if (sourceInfo.type === "if-else") {
      if (handle === "branch-0" || handle === "0") {
        return { ...edge, sourceHandle: "true", type: "deletable" } as unknown as WorkflowEdge;
      }
      if (handle === "branch-1" || handle === "1") {
        return { ...edge, sourceHandle: "false", type: "deletable" } as unknown as WorkflowEdge;
      }
    }

    if (sourceInfo.type === "switch" && sourceInfo.branches) {
      const branchMatch = handle?.match(/^branch-(\d+)$/);
      if (branchMatch) {
        const idx = parseInt(branchMatch[1], 10);
        if (idx < sourceInfo.branches.length) {
          return { ...edge, sourceHandle: sourceInfo.branches[idx].label, type: "deletable" } as unknown as WorkflowEdge;
        }
      }
    }

    // Fix ask-user: when single-select (not multi, not AI), handles are "option-N"
    // LLM might use "branch-N" instead
    if (sourceInfo.type === "ask-user" && !sourceInfo.multipleSelection && !sourceInfo.aiSuggestOptions) {
      const branchMatch = handle?.match(/^branch-(\d+)$/);
      if (branchMatch) {
        return { ...edge, sourceHandle: `option-${branchMatch[1]}`, type: "deletable" } as unknown as WorkflowEdge;
      }
    }

    return { ...edge, type: "deletable" } as unknown as WorkflowEdge;
  });
}


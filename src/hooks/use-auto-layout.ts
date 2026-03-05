import { useCallback } from "react";
import Dagre from "@dagrejs/dagre";
import { useReactFlow } from "@xyflow/react";
import type { NodeType, WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { NodeSize, NODE_SIZE_DIMENSIONS } from "@/nodes/shared/base-node";

const LAYOUT_DURATION = 400;

interface AutoLayoutOptions {
  getNodes: () => WorkflowNode[];
  getEdges: () => WorkflowEdge[];
  setNodes: (updater: (prev: WorkflowNode[]) => WorkflowNode[]) => void;
  onComplete?: (nodes: WorkflowNode[]) => void;
}

// ── Branch handle ordering ──────────────────────────────────────────────────
// If-else handles: "true" (first/top) → "false" (second/bottom)
const IF_ELSE_HANDLE_ORDER: Record<string, number> = { true: 0, false: 1 };

/** Minimum vertical distance (px) between branch target nodes. */
const MIN_BRANCH_GAP = 300;

/**
 * After Dagre computes positions, reorder branch targets so that:
 *   - if-else: "true" target is ABOVE (smaller y) "false" target
 *   - switch:  branch targets are stacked top-to-bottom in branch order
 *
 * Also enforces a minimum vertical gap between branch targets and centres
 * them around the branching node so the edges fan out cleanly.
 *
 * Dagre doesn't know about sourceHandles so it places branch targets
 * in an arbitrary vertical order. This pass fixes that and adjusts
 * the positions of their entire downstream subtrees.
 */
function fixBranchOrdering(
  positions: Record<string, { x: number; y: number }>,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
) {
  const nodeDataMap = new Map<string, Record<string, unknown>>();
  for (const n of nodes) {
    nodeDataMap.set(n.id, n.data as Record<string, unknown>);
  }

  // Build outgoing-edge map grouped by source
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
  }

  for (const node of nodes) {
    const d = nodeDataMap.get(node.id);
    if (!d) continue;
    const nodeType = d.type as string;

    const branchEdges = outgoing.get(node.id);
    if (!branchEdges || branchEdges.length < 2) continue;

    let orderedTargetIds: string[] | null = null;

    if (nodeType === "if-else") {
      // Sort edges by handle order: "true" first, "false" second
      const sorted = [...branchEdges]
        .filter((e) => e.sourceHandle === "true" || e.sourceHandle === "false")
        .sort((a, b) => (IF_ELSE_HANDLE_ORDER[a.sourceHandle ?? ""] ?? 99) - (IF_ELSE_HANDLE_ORDER[b.sourceHandle ?? ""] ?? 99));
      if (sorted.length >= 2) {
        orderedTargetIds = sorted.map((e) => e.target);
      }
    } else if (nodeType === "switch") {
      const branches = d.branches as Array<{ label: string }> | undefined;
      if (branches && branches.length >= 2) {
        // Build label → edge target lookup
        const labelToTarget = new Map<string, string>();
        for (const e of branchEdges) {
          if (e.sourceHandle) labelToTarget.set(e.sourceHandle, e.target);
        }
        // Order targets by branch definition order
        const ordered: string[] = [];
        for (const branch of branches) {
          const target = labelToTarget.get(branch.label);
          if (target) ordered.push(target);
        }
        if (ordered.length >= 2) orderedTargetIds = ordered;
      }
    }

    if (!orderedTargetIds) continue;

    // Only process targets that have computed positions
    const validTargetIds = orderedTargetIds.filter((id) => positions[id]);
    if (validTargetIds.length < 2) continue;

    // ── Compute ideal positions centred around the branching node ──
    const branchNodeY = positions[node.id]?.y;
    if (branchNodeY === undefined) continue;

    const count = validTargetIds.length;
    // Total span needed: (count - 1) * gap, centred on branchNodeY
    const totalSpan = (count - 1) * MIN_BRANCH_GAP;
    const topY = branchNodeY - totalSpan / 2;

    // Assign ideal y positions and compute deltas + shift subtrees
    for (let i = 0; i < validTargetIds.length; i++) {
      const targetId = validTargetIds[i];
      const idealY = topY + i * MIN_BRANCH_GAP;
      const oldY = positions[targetId].y;
      const delta = idealY - oldY;

      if (Math.abs(delta) < 1) continue; // already close enough

      // Move the target and its entire downstream subtree
      const subtree = collectSubtree(targetId, outgoing, new Set(validTargetIds));
      for (const id of subtree) {
        if (positions[id]) {
          positions[id] = { x: positions[id].x, y: positions[id].y + delta };
        }
      }
    }
  }
}

/** BFS to collect all downstream nodes from a root, stopping at nodes in the stopSet (other branch roots). */
function collectSubtree(
  rootId: string,
  outgoing: Map<string, WorkflowEdge[]>,
  stopSet: Set<string>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const children = outgoing.get(id);
    if (children) {
      for (const e of children) {
        if (!visited.has(e.target) && !stopSet.has(e.target)) {
          queue.push(e.target);
        }
      }
    }
  }
  return visited;
}

/**
 * Hook that provides auto-layout functionality using Dagre.
 * Works for both root canvas (store-based) and sub-workflow canvas (local state).
 */
export function useAutoLayout({ getNodes, getEdges, setNodes, onComplete }: AutoLayoutOptions) {
  const { fitView } = useReactFlow();

  const autoLayout = useCallback(() => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    if (currentNodes.length === 0) return;

    const defaultDim = NODE_SIZE_DIMENSIONS[NodeSize.Medium];
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 120, ranksep: 200, marginx: 60, marginy: 60 });

    currentNodes.forEach((node) => {
      const entry = NODE_REGISTRY[node.type as NodeType];
      const dim = NODE_SIZE_DIMENSIONS[entry?.size ?? NodeSize.Medium] ?? defaultDim;
      g.setNode(node.id, { width: dim.width, height: dim.height });
    });

    currentEdges.forEach((edge) => g.setEdge(edge.source, edge.target));
    Dagre.layout(g);

    const targetPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach((node) => {
      const dn = g.node(node.id);
      if (dn) {
        targetPositions[node.id] = {
          x: dn.x - dn.width / 2,
          y: dn.y - dn.height / 2,
        };
      }
    });

    // Fix branch ordering: ensure if-else "true" is above "false",
    // and switch branches are ordered top-to-bottom by definition order.
    fixBranchOrdering(targetPositions, currentNodes, currentEdges);

    const start = performance.now();
    const startPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach((node) => {
      startPositions[node.id] = { ...node.position };
    });

    const animate = (now: number) => {
      const t = Math.min((now - start) / LAYOUT_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      setNodes((prev) => {
        const next = prev.map((node) => {
          const from = startPositions[node.id];
          const to = targetPositions[node.id];
          if (!from || !to) return node;
          return {
            ...node,
            position: {
              x: from.x + (to.x - from.x) * eased,
              y: from.y + (to.y - from.y) * eased,
            },
          };
        });
        if (t >= 1) onComplete?.(next);
        return next;
      });

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => fitView({ duration: 300, padding: 0.55 }), 50);
      }
    };

    requestAnimationFrame(animate);
  }, [getNodes, getEdges, setNodes, onComplete, fitView]);

  return autoLayout;
}

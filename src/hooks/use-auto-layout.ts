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
    g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 200, marginx: 60, marginy: 60 });

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


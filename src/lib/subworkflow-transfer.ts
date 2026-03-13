import { createNodeFromType } from "@/lib/node-registry";
import type { WorkflowEdge, WorkflowNode, WorkflowNodeData } from "@/types/workflow";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";

const DEFAULT_INSERT_POSITION = { x: 340, y: 200 };

function containsNestedSubWorkflowId(nodes: WorkflowNode[], targetId: string): boolean {
  return nodes.some((node) => {
    if (node.id === targetId) return true;
    if (node.data?.type !== "sub-workflow") return false;
    const data = node.data as SubWorkflowNodeData;
    return containsNestedSubWorkflowId(data.subNodes ?? [], targetId);
  });
}

function ensureSubWorkflowScaffold(subNodes: WorkflowNode[]): WorkflowNode[] {
  if (subNodes.length > 0) return subNodes;

  const startNode = {
    ...createNodeFromType("start", { x: 80, y: 200 }),
    deletable: false,
  } as WorkflowNode;
  const endNode = createNodeFromType("end", { x: 600, y: 200 }) as WorkflowNode;

  return [startNode, endNode];
}

function getInsertedNodePosition(subNodes: WorkflowNode[]): { x: number; y: number } {
  const movableNodes = subNodes.filter((node) => node.data?.type !== "start" && node.data?.type !== "end");
  const offset = movableNodes.length * 40;

  return {
    x: DEFAULT_INSERT_POSITION.x,
    y: DEFAULT_INSERT_POSITION.y + offset,
  };
}

export interface MoveNodeIntoSubWorkflowResult {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  moved: boolean;
}

export interface DetachNodeFromContextResult {
  node: WorkflowNode | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  detached: boolean;
}

export function detachNodeFromContext({
  nodes,
  edges,
  sourceNodeId,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sourceNodeId: string;
}): DetachNodeFromContextResult {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId);
  if (!sourceNode || sourceNode.data?.type === "start") {
    return { node: null, nodes, edges, detached: false };
  }

  return {
    node: {
      ...sourceNode,
      selected: false,
      data: {
        ...sourceNode.data,
        name: sourceNode.id,
      } as WorkflowNodeData,
    },
    nodes: nodes.filter((node) => node.id !== sourceNodeId),
    edges: edges.filter((edge) => edge.source !== sourceNodeId && edge.target !== sourceNodeId),
    detached: true,
  };
}

export function moveNodeIntoSubWorkflowContext({
  nodes,
  edges,
  sourceNodeId,
  targetSubWorkflowNodeId,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sourceNodeId: string;
  targetSubWorkflowNodeId: string;
}): MoveNodeIntoSubWorkflowResult {
  if (sourceNodeId === targetSubWorkflowNodeId) {
    return { nodes, edges, moved: false };
  }

  const sourceNode = nodes.find((node) => node.id === sourceNodeId);
  const targetNode = nodes.find((node) => node.id === targetSubWorkflowNodeId);

  if (!sourceNode || !targetNode || targetNode.data?.type !== "sub-workflow") {
    return { nodes, edges, moved: false };
  }

  if (sourceNode.data?.type === "start") {
    return { nodes, edges, moved: false };
  }

  if (
    sourceNode.data?.type === "sub-workflow" &&
    containsNestedSubWorkflowId(
      ((sourceNode.data as SubWorkflowNodeData).subNodes ?? []) as WorkflowNode[],
      targetSubWorkflowNodeId,
    )
  ) {
    return { nodes, edges, moved: false };
  }

  const targetData = targetNode.data as SubWorkflowNodeData;
  const existingSubNodes = ensureSubWorkflowScaffold(targetData.subNodes ?? []);
  const detachResult = detachNodeFromContext({ nodes, edges, sourceNodeId });
  if (!detachResult.detached || !detachResult.node) {
    return { nodes, edges, moved: false };
  }

  const movedNode: WorkflowNode = {
    ...detachResult.node,
    position: getInsertedNodePosition(existingSubNodes),
  };

  const updatedSubNodes = [...existingSubNodes, movedNode];
  const updatedNodes = detachResult.nodes
    .map((node) => {
      if (node.id !== targetSubWorkflowNodeId) return node;
      return {
        ...node,
        data: {
          ...targetData,
          subNodes: updatedSubNodes,
          nodeCount: updatedSubNodes.length,
        } as WorkflowNodeData,
      };
    });

  return {
    nodes: updatedNodes,
    edges: detachResult.edges,
    moved: true,
  };
}


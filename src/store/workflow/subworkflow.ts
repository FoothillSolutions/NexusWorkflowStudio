import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
} from "@/types/workflow";
import { WorkflowNodeType } from "@/types/workflow";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";

export function resolveParentNodes(
  rootNodes: WorkflowNode[],
  stack: { nodeId: string; label: string }[],
): WorkflowNode[] {
  if (stack.length <= 1) return rootNodes;

  let context: WorkflowNode[] = rootNodes;
  for (let index = 0; index < stack.length - 1; index += 1) {
    const entry = stack[index];
    const node = context.find((candidate) => candidate.id === entry.nodeId);
    const data = node?.data as SubWorkflowNodeData | undefined;
    if (!data?.subNodes) return rootNodes;
    context = data.subNodes;
  }

  return context;
}

export function updateNestedSubWorkflowNodes(
  nodes: WorkflowNode[],
  ancestorPath: string[],
  nextSubNodes: WorkflowNode[],
): WorkflowNode[] {
  if (ancestorPath.length === 0) return nodes;

  const [currentAncestorId, ...remainingPath] = ancestorPath;

  return nodes.map((node) => {
    if (node.id !== currentAncestorId || node.data?.type !== WorkflowNodeType.SubWorkflow) {
      return node;
    }

    const data = node.data as SubWorkflowNodeData;
    const updatedSubNodes =
      remainingPath.length === 0
        ? nextSubNodes
        : updateNestedSubWorkflowNodes(data.subNodes, remainingPath, nextSubNodes);

    return {
      ...node,
      data: {
        ...data,
        subNodes: updatedSubNodes,
        nodeCount: updatedSubNodes.length,
      } as WorkflowNodeData,
    };
  });
}

export function updateNestedSubWorkflowEdges(
  nodes: WorkflowNode[],
  ancestorPath: string[],
  nextSubEdges: WorkflowEdge[],
): WorkflowNode[] {
  if (ancestorPath.length === 0) return nodes;

  const [currentAncestorId, ...remainingPath] = ancestorPath;

  return nodes.map((node) => {
    if (node.id !== currentAncestorId || node.data?.type !== WorkflowNodeType.SubWorkflow) {
      return node;
    }

    const data = node.data as SubWorkflowNodeData;
    const updatedSubNodes =
      remainingPath.length === 0
        ? data.subNodes
        : updateNestedSubWorkflowEdges(data.subNodes, remainingPath, nextSubEdges);
    const updatedSubEdges = remainingPath.length === 0 ? nextSubEdges : data.subEdges;

    return {
      ...node,
      data: {
        ...data,
        subNodes: updatedSubNodes,
        subEdges: updatedSubEdges,
      } as WorkflowNodeData,
    };
  });
}



import { addEdge, type Connection } from "@xyflow/react";
import {
  AGENT_LIKE_NODE_TYPES,
  WorkflowNodeType,
  type NodeType,
  type WorkflowEdge,
  type WorkflowNode,
} from "@/types/workflow";

export const WORKFLOW_EDGE_TYPE = "deletable" as const;
export const SCRIPT_SOURCE_HANDLE = "script-out";
export const SKILL_TARGET_HANDLE = "skills";
export const SCRIPT_TARGET_HANDLE = "scripts";
export const DOCUMENT_TARGET_HANDLE = "docs";

interface NormalizeWorkflowConnectionOptions {
  connection: Connection;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function findNodeType(nodes: WorkflowNode[], nodeId: string | null | undefined): NodeType | null {
  if (!nodeId) return null;
  return (nodes.find((node) => node.id === nodeId)?.data?.type as NodeType | undefined) ?? null;
}

export function normalizeWorkflowConnection({
  connection,
  nodes,
  edges,
}: NormalizeWorkflowConnectionOptions): WorkflowEdge[] | null {
  if (!connection.source || !connection.target || connection.source === connection.target) {
    return null;
  }

  const sourceType = findNodeType(nodes, connection.source);
  const targetType = findNodeType(nodes, connection.target);

  if (sourceType === WorkflowNodeType.Script) {
    if (targetType !== WorkflowNodeType.Skill) return null;
    return addEdge(
      {
        ...connection,
        sourceHandle: SCRIPT_SOURCE_HANDLE,
        targetHandle: SCRIPT_TARGET_HANDLE,
        type: WORKFLOW_EDGE_TYPE,
      },
      edges,
    );
  }

  if (sourceType === WorkflowNodeType.Skill) {
    if (!targetType || !AGENT_LIKE_NODE_TYPES.has(targetType)) return null;
    return addEdge(
      {
        ...connection,
        targetHandle: SKILL_TARGET_HANDLE,
        type: WORKFLOW_EDGE_TYPE,
      },
      edges,
    );
  }

  if (sourceType === WorkflowNodeType.Document) {
    if (!targetType || !AGENT_LIKE_NODE_TYPES.has(targetType)) return null;
    return addEdge(
      {
        ...connection,
        targetHandle: DOCUMENT_TARGET_HANDLE,
        type: WORKFLOW_EDGE_TYPE,
      },
      edges,
    );
  }

  if (targetType === WorkflowNodeType.Skill || targetType === WorkflowNodeType.Document) {
    return null;
  }

  if (
    connection.targetHandle === SKILL_TARGET_HANDLE
    || connection.targetHandle === DOCUMENT_TARGET_HANDLE
    || connection.targetHandle === SCRIPT_TARGET_HANDLE
  ) {
    return null;
  }

  if (
    sourceType === WorkflowNodeType.ParallelAgent
    && connection.sourceHandle?.startsWith("branch-")
    && targetType !== WorkflowNodeType.Agent
  ) {
    return null;
  }

  const filteredEdges = edges.filter(
    (edge) => !(edge.source === connection.source && edge.sourceHandle === connection.sourceHandle),
  );

  return addEdge({ ...connection, type: WORKFLOW_EDGE_TYPE }, filteredEdges);
}


/**
 * TypeScript types for SpacetimeDB row shapes and reducer payloads.
 *
 * These mirror the SpacetimeDB table schemas defined in spacetime/nexus/src/lib.ts
 * and provide the type bridge between SpacetimeDB rows and the existing Zustand
 * store types (WorkflowNode, WorkflowEdge, WorkspaceRecord, WorkflowRecord, etc.).
 */

import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";
import type { WorkspaceRecord, WorkflowRecord, ChangeEventType, ChangeEvent } from "@/lib/workspace/types";
import type { KnowledgeDoc } from "@/types/knowledge";

// ── SpacetimeDB Row Types ──────────────────────────────────────────────────

export interface SpacetimeWorkspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpacetimeWorkspaceMember {
  workspaceId: string;
  identity: string; // hex-encoded identity
  displayName: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
}

export interface SpacetimeWorkflow {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string;
}

export interface SpacetimeWorkflowNode {
  workflowId: string;
  nodeId: string;
  type: string;
  positionJson: string;
  dataJson: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SpacetimeWorkflowEdge {
  workflowId: string;
  edgeId: string;
  source: string;
  target: string;
  handlesJson: string;
  dataJson: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SpacetimeWorkflowUiState {
  workflowId: string;
  uiStateJson: string;
}

export interface SpacetimeBrainDoc {
  id: string;
  workspaceId: string;
  title: string;
  contentJson: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SpacetimeBrainDocVersion {
  docId: string;
  versionId: string;
  contentJson: string;
  createdAt: string;
}

export interface SpacetimeBrainFeedback {
  docId: string;
  identity: string;
  type: string;
  comment: string;
  createdAt: string;
}

export interface SpacetimeWorkflowChangeEvent {
  workflowId: string;
  eventType: string;
  nodeId: string | null;
  details: string;
  timestamp: string;
}

export interface SpacetimePresence {
  workspaceId: string;
  workflowId: string;
  identity: string;
  displayName: string;
  selectedNodeId: string | null;
  lastSeenAt: string;
}

// ── Batch Operation Types ──────────────────────────────────────────────────

export type WorkflowOpType =
  | "upsert_node"
  | "delete_node"
  | "upsert_edge"
  | "delete_edge";

export interface WorkflowOp {
  op: WorkflowOpType;
  nodeId?: string;
  type?: string;
  positionJson?: string;
  dataJson?: string;
  edgeId?: string;
  source?: string;
  target?: string;
  handlesJson?: string;
}

// ── Type Conversion Utilities ──────────────────────────────────────────────

/** Convert a SpacetimeDB workflow node row to a React Flow WorkflowNode. */
export function spacetimeNodeToWorkflowNode(row: SpacetimeWorkflowNode): WorkflowNode {
  const position = JSON.parse(row.positionJson) as { x: number; y: number };
  const data = JSON.parse(row.dataJson);
  return {
    id: row.nodeId,
    type: row.type,
    position,
    data,
  } as WorkflowNode;
}

/** Convert a React Flow WorkflowNode to SpacetimeDB upsert operation. */
export function workflowNodeToOp(node: WorkflowNode): WorkflowOp {
  return {
    op: "upsert_node",
    nodeId: node.id,
    type: node.type ?? "default",
    positionJson: JSON.stringify(node.position),
    dataJson: JSON.stringify(node.data),
  };
}

/** Convert a SpacetimeDB workflow edge row to a React Flow WorkflowEdge. */
export function spacetimeEdgeToWorkflowEdge(row: SpacetimeWorkflowEdge): WorkflowEdge {
  const handles = JSON.parse(row.handlesJson) as {
    sourceHandle?: string | null;
    targetHandle?: string | null;
  };
  const data = row.dataJson !== "{}" ? JSON.parse(row.dataJson) : undefined;
  return {
    id: row.edgeId,
    source: row.source,
    target: row.target,
    sourceHandle: handles.sourceHandle ?? null,
    targetHandle: handles.targetHandle ?? null,
    ...(data ? { data } : {}),
  } as WorkflowEdge;
}

/** Convert a React Flow WorkflowEdge to SpacetimeDB upsert operation. */
export function workflowEdgeToOp(edge: WorkflowEdge): WorkflowOp {
  return {
    op: "upsert_edge",
    edgeId: edge.id,
    source: edge.source,
    target: edge.target,
    handlesJson: JSON.stringify({
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    }),
    dataJson: edge.data ? JSON.stringify(edge.data) : "{}",
  };
}

/** Convert SpacetimeDB workspace row to WorkspaceRecord. */
export function spacetimeToWorkspaceRecord(row: SpacetimeWorkspace): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Convert SpacetimeDB workflow row to WorkflowRecord. */
export function spacetimeToWorkflowRecord(row: SpacetimeWorkflow): WorkflowRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastModifiedBy: row.lastModifiedBy,
  };
}

/** Convert SpacetimeDB brain doc row to KnowledgeDoc. */
export function spacetimeToBrainDoc(row: SpacetimeBrainDoc): KnowledgeDoc {
  const content = JSON.parse(row.contentJson);
  return {
    id: row.id,
    title: row.title,
    ...content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as KnowledgeDoc;
}

/** Convert KnowledgeDoc to SpacetimeDB brain doc content JSON. */
export function brainDocToContentJson(doc: Partial<KnowledgeDoc>): string {
  const { id: _id, title: _title, createdAt: _ca, updatedAt: _ua, ...content } = doc as KnowledgeDoc;
  return JSON.stringify(content);
}

/** Convert SpacetimeDB change event row to ChangeEvent. */
export function spacetimeToChangeEvent(row: SpacetimeWorkflowChangeEvent): ChangeEvent {
  const details = JSON.parse(row.details) as {
    nodeName?: string;
    from?: string;
    to?: string;
    by?: string;
    edgeId?: string;
  };
  return {
    type: row.eventType as ChangeEventType,
    nodeName: details.nodeName ?? details.edgeId ?? "",
    from: details.from,
    to: details.to,
    by: details.by ?? "unknown",
    at: row.timestamp,
  };
}

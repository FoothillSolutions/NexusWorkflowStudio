/**
 * SpacetimeDB Module: Nexus Workflow Studio
 *
 * Defines all tables, views, and reducers for workspace persistence and
 * real-time collaboration. Uses private tables with public views filtered
 * by workspace membership for row-level access control.
 */

import {
  table,
  reducer,
  ReducerContext,
  Identity,
  ScheduleAt,
  Timestamp,
} from "@clockworklabs/spacetimedb-sdk/server";

// ── Table Definitions ──────────────────────────────────────────────────────

@table({ name: "workspace", primaryKey: "id", access: "private" })
export class Workspace {
  id!: string;
  name!: string;
  createdAt!: string; // ISO timestamp
  updatedAt!: string;
}

@table({ name: "workspace_member", access: "private" })
export class WorkspaceMember {
  workspaceId!: string;
  identity!: Identity;
  displayName!: string;
  role!: string; // "owner" | "editor" | "viewer"
  joinedAt!: string;
}

@table({ name: "workspace_invite", access: "private" })
export class WorkspaceInvite {
  workspaceId!: string;
  tokenHash!: string;
  createdAt!: string;
  revokedAt!: string | null;
}

@table({ name: "workflow", primaryKey: "id", access: "private" })
export class Workflow {
  id!: string;
  workspaceId!: string;
  name!: string;
  createdAt!: string;
  updatedAt!: string;
  lastModifiedBy!: string;
}

@table({ name: "workflow_node", access: "private" })
export class WorkflowNode {
  workflowId!: string;
  nodeId!: string;
  type!: string;
  positionJson!: string; // JSON: { x: number, y: number }
  dataJson!: string;     // JSON: WorkflowNodeData
  updatedAt!: string;
  updatedBy!: string;
}

@table({ name: "workflow_edge", access: "private" })
export class WorkflowEdge {
  workflowId!: string;
  edgeId!: string;
  source!: string;
  target!: string;
  handlesJson!: string; // JSON: { sourceHandle, targetHandle }
  dataJson!: string;    // JSON: edge data or "{}"
  updatedAt!: string;
  updatedBy!: string;
}

@table({ name: "workflow_ui_state", primaryKey: "workflowId", access: "private" })
export class WorkflowUiState {
  workflowId!: string;
  uiStateJson!: string; // JSON: { sidebarOpen, minimapVisible, viewport, ... }
}

@table({ name: "brain_doc", primaryKey: "id", access: "private" })
export class BrainDoc {
  id!: string;
  workspaceId!: string;
  title!: string;
  contentJson!: string; // JSON: full KnowledgeDoc content fields
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}

@table({ name: "brain_doc_version", access: "private" })
export class BrainDocVersion {
  docId!: string;
  versionId!: string;
  contentJson!: string;
  createdAt!: string;
}

@table({ name: "brain_feedback", access: "private" })
export class BrainFeedback {
  docId!: string;
  identity!: Identity;
  type!: string; // FeedbackRating: "success" | "failure" | "neutral"
  comment!: string;
  createdAt!: string;
}

@table({ name: "workflow_change_event", access: "private" })
export class WorkflowChangeEvent {
  workflowId!: string;
  eventType!: string; // "node_added" | "node_deleted" | "node_renamed" | "edge_added" | "edge_deleted"
  nodeId!: string | null;
  details!: string; // JSON: { nodeName?, from?, to?, by? }
  timestamp!: string;
}

@table({ name: "presence", access: "private" })
export class Presence {
  workspaceId!: string;
  workflowId!: string;
  identity!: Identity;
  displayName!: string;
  selectedNodeId!: string | null;
  lastSeenAt!: string;
}

// ── Helper: Membership Check ───────────────────────────────────────────────

function requireMembership(ctx: ReducerContext, workspaceId: string): WorkspaceMember {
  const member = WorkspaceMember.filterByWorkspaceId(workspaceId)
    .find((m: WorkspaceMember) => m.identity.isEqual(ctx.sender));
  if (!member) {
    throw new Error(`Not a member of workspace ${workspaceId}`);
  }
  return member;
}

function isMember(ctx: ReducerContext, workspaceId: string): boolean {
  return WorkspaceMember.filterByWorkspaceId(workspaceId)
    .some((m: WorkspaceMember) => m.identity.isEqual(ctx.sender));
}

// ── Identity Lifecycle ─────────────────────────────────────────────────────

@reducer({ name: "__identity_connected__" })
export function identityConnected(ctx: ReducerContext): void {
  // No-op on connect — presence is explicitly started by the client
}

@reducer({ name: "__identity_disconnected__" })
export function identityDisconnected(ctx: ReducerContext): void {
  // Clean up presence rows for the disconnected identity
  const presenceRows = Presence.filterByIdentity(ctx.sender);
  for (const row of presenceRows) {
    Presence.delete(row);
  }
}

// ── Workspace Reducers ─────────────────────────────────────────────────────

@reducer({ name: "create_workspace" })
export function createWorkspace(
  ctx: ReducerContext,
  id: string,
  name: string,
  displayName: string,
): void {
  const now = new Date().toISOString();

  Workspace.insert({
    id,
    name,
    createdAt: now,
    updatedAt: now,
  });

  // Creator becomes owner
  WorkspaceMember.insert({
    workspaceId: id,
    identity: ctx.sender,
    displayName,
    role: "owner",
    joinedAt: now,
  });
}

@reducer({ name: "rename_workspace" })
export function renameWorkspace(
  ctx: ReducerContext,
  workspaceId: string,
  newName: string,
): void {
  requireMembership(ctx, workspaceId);
  const ws = Workspace.findById(workspaceId);
  if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

  Workspace.updateById(workspaceId, {
    ...ws,
    name: newName,
    updatedAt: new Date().toISOString(),
  });
}

@reducer({ name: "delete_workspace" })
export function deleteWorkspace(
  ctx: ReducerContext,
  workspaceId: string,
): void {
  const member = requireMembership(ctx, workspaceId);
  if (member.role !== "owner") throw new Error("Only owners can delete workspaces");

  // Delete all related data
  for (const wf of Workflow.filterByWorkspaceId(workspaceId)) {
    deleteWorkflowData(wf.id);
    Workflow.delete(wf);
  }
  for (const m of WorkspaceMember.filterByWorkspaceId(workspaceId)) {
    WorkspaceMember.delete(m);
  }
  for (const inv of WorkspaceInvite.filterByWorkspaceId(workspaceId)) {
    WorkspaceInvite.delete(inv);
  }
  for (const doc of BrainDoc.filterByWorkspaceId(workspaceId)) {
    for (const v of BrainDocVersion.filterByDocId(doc.id)) {
      BrainDocVersion.delete(v);
    }
    for (const f of BrainFeedback.filterByDocId(doc.id)) {
      BrainFeedback.delete(f);
    }
    BrainDoc.delete(doc);
  }
  for (const p of Presence.filterByWorkspaceId(workspaceId)) {
    Presence.delete(p);
  }

  const ws = Workspace.findById(workspaceId);
  if (ws) Workspace.delete(ws);
}

// ── Invite Reducers ────────────────────────────────────────────────────────

@reducer({ name: "create_invite" })
export function createInvite(
  ctx: ReducerContext,
  workspaceId: string,
  tokenHash: string,
): void {
  requireMembership(ctx, workspaceId);

  WorkspaceInvite.insert({
    workspaceId,
    tokenHash,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  });
}

@reducer({ name: "join_workspace" })
export function joinWorkspace(
  ctx: ReducerContext,
  tokenHash: string,
  displayName: string,
): void {
  const invite = WorkspaceInvite.filterByTokenHash(tokenHash)
    .find((inv: WorkspaceInvite) => inv.revokedAt === null);

  if (!invite) throw new Error("Invalid or revoked invite token");

  // Check if already a member
  if (isMember(ctx, invite.workspaceId)) return;

  WorkspaceMember.insert({
    workspaceId: invite.workspaceId,
    identity: ctx.sender,
    displayName,
    role: "editor",
    joinedAt: new Date().toISOString(),
  });
}

// ── Workflow Reducers ──────────────────────────────────────────────────────

@reducer({ name: "create_workflow" })
export function createWorkflow(
  ctx: ReducerContext,
  id: string,
  workspaceId: string,
  name: string,
  displayName: string,
): void {
  requireMembership(ctx, workspaceId);
  const now = new Date().toISOString();

  Workflow.insert({
    id,
    workspaceId,
    name,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: displayName,
  });
}

@reducer({ name: "rename_workflow" })
export function renameWorkflow(
  ctx: ReducerContext,
  workflowId: string,
  newName: string,
): void {
  const wf = Workflow.findById(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  requireMembership(ctx, wf.workspaceId);

  const oldName = wf.name;
  Workflow.updateById(workflowId, {
    ...wf,
    name: newName,
    updatedAt: new Date().toISOString(),
  });

  WorkflowChangeEvent.insert({
    workflowId,
    eventType: "node_renamed",
    nodeId: null,
    details: JSON.stringify({ from: oldName, to: newName, by: "user" }),
    timestamp: new Date().toISOString(),
  });
}

@reducer({ name: "delete_workflow" })
export function deleteWorkflow(
  ctx: ReducerContext,
  workflowId: string,
): void {
  const wf = Workflow.findById(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  requireMembership(ctx, wf.workspaceId);

  deleteWorkflowData(workflowId);
  Workflow.delete(wf);
}

function deleteWorkflowData(workflowId: string): void {
  for (const node of WorkflowNode.filterByWorkflowId(workflowId)) {
    WorkflowNode.delete(node);
  }
  for (const edge of WorkflowEdge.filterByWorkflowId(workflowId)) {
    WorkflowEdge.delete(edge);
  }
  for (const evt of WorkflowChangeEvent.filterByWorkflowId(workflowId)) {
    WorkflowChangeEvent.delete(evt);
  }
  const uiState = WorkflowUiState.findByWorkflowId(workflowId);
  if (uiState) WorkflowUiState.delete(uiState);
}

// ── Batch Operation Reducer ────────────────────────────────────────────────

/**
 * Batch applies workflow graph operations. Each operation is one of:
 *   { op: "upsert_node", nodeId, type, positionJson, dataJson }
 *   { op: "delete_node", nodeId }
 *   { op: "upsert_edge", edgeId, source, target, handlesJson, dataJson }
 *   { op: "delete_edge", edgeId }
 *
 * Reducer writes a workflow_change_event for each mutation.
 */
@reducer({ name: "apply_workflow_ops" })
export function applyWorkflowOps(
  ctx: ReducerContext,
  workflowId: string,
  opsJson: string, // JSON array of operations
  displayName: string,
): void {
  const wf = Workflow.findById(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  requireMembership(ctx, wf.workspaceId);

  const ops = JSON.parse(opsJson) as WorkflowOp[];
  const now = new Date().toISOString();

  for (const op of ops) {
    switch (op.op) {
      case "upsert_node": {
        const existing = WorkflowNode.filterByWorkflowId(workflowId)
          .find((n: WorkflowNode) => n.nodeId === op.nodeId);

        if (existing) {
          WorkflowNode.delete(existing);
        }

        WorkflowNode.insert({
          workflowId,
          nodeId: op.nodeId!,
          type: op.type!,
          positionJson: op.positionJson!,
          dataJson: op.dataJson!,
          updatedAt: now,
          updatedBy: displayName,
        });

        if (!existing) {
          WorkflowChangeEvent.insert({
            workflowId,
            eventType: "node_added",
            nodeId: op.nodeId!,
            details: JSON.stringify({ nodeName: op.type, by: displayName }),
            timestamp: now,
          });
        }
        break;
      }

      case "delete_node": {
        const node = WorkflowNode.filterByWorkflowId(workflowId)
          .find((n: WorkflowNode) => n.nodeId === op.nodeId);
        if (node) {
          WorkflowNode.delete(node);
          WorkflowChangeEvent.insert({
            workflowId,
            eventType: "node_deleted",
            nodeId: op.nodeId!,
            details: JSON.stringify({ nodeName: node.type, by: displayName }),
            timestamp: now,
          });
        }
        break;
      }

      case "upsert_edge": {
        const existing = WorkflowEdge.filterByWorkflowId(workflowId)
          .find((e: WorkflowEdge) => e.edgeId === op.edgeId);

        if (existing) {
          WorkflowEdge.delete(existing);
        }

        WorkflowEdge.insert({
          workflowId,
          edgeId: op.edgeId!,
          source: op.source!,
          target: op.target!,
          handlesJson: op.handlesJson ?? "{}",
          dataJson: op.dataJson ?? "{}",
          updatedAt: now,
          updatedBy: displayName,
        });

        if (!existing) {
          WorkflowChangeEvent.insert({
            workflowId,
            eventType: "edge_added",
            nodeId: null,
            details: JSON.stringify({ edgeId: op.edgeId, by: displayName }),
            timestamp: now,
          });
        }
        break;
      }

      case "delete_edge": {
        const edge = WorkflowEdge.filterByWorkflowId(workflowId)
          .find((e: WorkflowEdge) => e.edgeId === op.edgeId);
        if (edge) {
          WorkflowEdge.delete(edge);
          WorkflowChangeEvent.insert({
            workflowId,
            eventType: "edge_deleted",
            nodeId: null,
            details: JSON.stringify({ edgeId: op.edgeId, by: displayName }),
            timestamp: now,
          });
        }
        break;
      }
    }
  }

  // Update workflow timestamp
  Workflow.updateById(workflowId, {
    ...wf,
    updatedAt: now,
    lastModifiedBy: displayName,
  });
}

interface WorkflowOp {
  op: "upsert_node" | "delete_node" | "upsert_edge" | "delete_edge";
  nodeId?: string;
  type?: string;
  positionJson?: string;
  dataJson?: string;
  edgeId?: string;
  source?: string;
  target?: string;
  handlesJson?: string;
}

// ── UI State Reducer ───────────────────────────────────────────────────────

@reducer({ name: "update_workflow_ui_state" })
export function updateWorkflowUiState(
  ctx: ReducerContext,
  workflowId: string,
  uiStateJson: string,
): void {
  const wf = Workflow.findById(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  requireMembership(ctx, wf.workspaceId);

  const existing = WorkflowUiState.findByWorkflowId(workflowId);
  if (existing) {
    WorkflowUiState.updateByWorkflowId(workflowId, {
      ...existing,
      uiStateJson,
    });
  } else {
    WorkflowUiState.insert({ workflowId, uiStateJson });
  }
}

// ── Brain Reducers ─────────────────────────────────────────────────────────

@reducer({ name: "save_brain_doc" })
export function saveBrainDoc(
  ctx: ReducerContext,
  id: string,
  workspaceId: string,
  title: string,
  contentJson: string,
  versionId: string | null,
): void {
  requireMembership(ctx, workspaceId);
  const now = new Date().toISOString();

  const existing = BrainDoc.findById(id);
  if (existing) {
    // Create version snapshot before overwriting
    if (versionId) {
      BrainDocVersion.insert({
        docId: id,
        versionId,
        contentJson: existing.contentJson,
        createdAt: now,
      });
    }

    BrainDoc.updateById(id, {
      ...existing,
      title,
      contentJson,
      updatedAt: now,
      deletedAt: null, // un-delete if previously soft-deleted
    });
  } else {
    BrainDoc.insert({
      id,
      workspaceId,
      title,
      contentJson,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }
}

@reducer({ name: "delete_brain_doc" })
export function deleteBrainDoc(
  ctx: ReducerContext,
  docId: string,
): void {
  const doc = BrainDoc.findById(docId);
  if (!doc) throw new Error(`Brain doc ${docId} not found`);
  requireMembership(ctx, doc.workspaceId);

  // Soft delete
  BrainDoc.updateById(docId, {
    ...doc,
    deletedAt: new Date().toISOString(),
  });
}

@reducer({ name: "record_brain_view" })
export function recordBrainView(
  ctx: ReducerContext,
  docId: string,
): void {
  const doc = BrainDoc.findById(docId);
  if (!doc) throw new Error(`Brain doc ${docId} not found`);
  requireMembership(ctx, doc.workspaceId);

  // Update the content JSON to increment view count
  const content = JSON.parse(doc.contentJson);
  if (content.metrics) {
    content.metrics.views = (content.metrics.views || 0) + 1;
    content.metrics.lastViewedAt = new Date().toISOString();
  }

  BrainDoc.updateById(docId, {
    ...doc,
    contentJson: JSON.stringify(content),
  });
}

@reducer({ name: "add_brain_feedback" })
export function addBrainFeedback(
  ctx: ReducerContext,
  docId: string,
  type: string,
  comment: string,
): void {
  const doc = BrainDoc.findById(docId);
  if (!doc) throw new Error(`Brain doc ${docId} not found`);
  requireMembership(ctx, doc.workspaceId);

  BrainFeedback.insert({
    docId,
    identity: ctx.sender,
    type,
    comment,
    createdAt: new Date().toISOString(),
  });
}

@reducer({ name: "restore_brain_doc_version" })
export function restoreBrainDocVersion(
  ctx: ReducerContext,
  docId: string,
  versionId: string,
  snapshotVersionId: string,
): void {
  const doc = BrainDoc.findById(docId);
  if (!doc) throw new Error(`Brain doc ${docId} not found`);
  requireMembership(ctx, doc.workspaceId);

  const version = BrainDocVersion.filterByDocId(docId)
    .find((v: BrainDocVersion) => v.versionId === versionId);
  if (!version) throw new Error(`Version ${versionId} not found`);

  const now = new Date().toISOString();

  // Snapshot current state before restoring
  BrainDocVersion.insert({
    docId,
    versionId: snapshotVersionId,
    contentJson: doc.contentJson,
    createdAt: now,
  });

  // Restore the version
  BrainDoc.updateById(docId, {
    ...doc,
    contentJson: version.contentJson,
    updatedAt: now,
    deletedAt: null,
  });
}

// ── Presence Reducer ───────────────────────────────────────────────────────

@reducer({ name: "update_presence" })
export function updatePresence(
  ctx: ReducerContext,
  workspaceId: string,
  workflowId: string,
  displayName: string,
  selectedNodeId: string | null,
): void {
  const now = new Date().toISOString();

  // Find existing presence row for this identity in this workspace+workflow
  const existing = Presence.filterByIdentity(ctx.sender)
    .find((p: Presence) => p.workspaceId === workspaceId && p.workflowId === workflowId);

  if (existing) {
    Presence.delete(existing);
  }

  Presence.insert({
    workspaceId,
    workflowId,
    identity: ctx.sender,
    displayName,
    selectedNodeId,
    lastSeenAt: now,
  });
}

// ── Import Reducers (for migration) ────────────────────────────────────────

@reducer({ name: "import_workspace" })
export function importWorkspace(
  ctx: ReducerContext,
  id: string,
  name: string,
  createdAt: string,
  updatedAt: string,
  displayName: string,
): void {
  // Check if already exists (idempotent)
  if (Workspace.findById(id)) return;

  Workspace.insert({ id, name, createdAt, updatedAt });

  WorkspaceMember.insert({
    workspaceId: id,
    identity: ctx.sender,
    displayName,
    role: "owner",
    joinedAt: new Date().toISOString(),
  });
}

@reducer({ name: "import_workflow_snapshot" })
export function importWorkflowSnapshot(
  ctx: ReducerContext,
  workflowId: string,
  workspaceId: string,
  name: string,
  nodesJson: string,
  edgesJson: string,
  uiStateJson: string,
  createdAt: string,
  updatedAt: string,
  lastModifiedBy: string,
): void {
  // Check if already exists (idempotent)
  if (Workflow.findById(workflowId)) return;
  requireMembership(ctx, workspaceId);

  Workflow.insert({
    id: workflowId,
    workspaceId,
    name,
    createdAt,
    updatedAt,
    lastModifiedBy,
  });

  // Import nodes
  const nodes = JSON.parse(nodesJson) as Array<{
    nodeId: string;
    type: string;
    positionJson: string;
    dataJson: string;
  }>;
  for (const node of nodes) {
    WorkflowNode.insert({
      workflowId,
      nodeId: node.nodeId,
      type: node.type,
      positionJson: node.positionJson,
      dataJson: node.dataJson,
      updatedAt,
      updatedBy: lastModifiedBy,
    });
  }

  // Import edges
  const edges = JSON.parse(edgesJson) as Array<{
    edgeId: string;
    source: string;
    target: string;
    handlesJson: string;
    dataJson: string;
  }>;
  for (const edge of edges) {
    WorkflowEdge.insert({
      workflowId,
      edgeId: edge.edgeId,
      source: edge.source,
      target: edge.target,
      handlesJson: edge.handlesJson,
      dataJson: edge.dataJson,
      updatedAt,
      updatedBy: lastModifiedBy,
    });
  }

  // Import UI state
  if (uiStateJson !== "{}") {
    WorkflowUiState.insert({ workflowId, uiStateJson });
  }
}

@reducer({ name: "import_brain_doc" })
export function importBrainDoc(
  ctx: ReducerContext,
  id: string,
  workspaceId: string,
  title: string,
  contentJson: string,
  createdAt: string,
  updatedAt: string,
): void {
  requireMembership(ctx, workspaceId);

  // Check if already exists (idempotent)
  if (BrainDoc.findById(id)) return;

  BrainDoc.insert({
    id,
    workspaceId,
    title,
    contentJson,
    createdAt,
    updatedAt,
    deletedAt: null,
  });
}

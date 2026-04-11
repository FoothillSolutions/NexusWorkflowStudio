import type { Identity } from "spacetimedb";
import { schema, table, t } from "spacetimedb/server";

const spacetimedb = schema({
  workspace: table(
    { name: "workspace", public: true },
    {
      id: t.string().primaryKey(),
      name: t.string(),
      createdAt: t.string(),
      updatedAt: t.string(),
    },
  ),

  workspaceMember: table(
    {
      name: "workspace_member",
      public: true,
      indexes: [
        { accessor: "byWorkspaceId", algorithm: "btree", columns: ["workspaceId"] },
        { accessor: "byIdentity", algorithm: "btree", columns: ["identity"] },
      ],
    },
    {
      workspaceId: t.string(),
      identity: t.identity(),
      displayName: t.string(),
      role: t.string(),
      joinedAt: t.string(),
    },
  ),

  workspaceInvite: table(
    {
      name: "workspace_invite",
      public: true,
      indexes: [
        { accessor: "byWorkspaceId", algorithm: "btree", columns: ["workspaceId"] },
        { accessor: "byTokenHash", algorithm: "btree", columns: ["tokenHash"] },
      ],
    },
    {
      workspaceId: t.string(),
      tokenHash: t.string(),
      createdAt: t.string(),
      revokedAt: t.string().optional(),
    },
  ),

  workflow: table(
    {
      name: "workflow",
      public: true,
      indexes: [{ accessor: "byWorkspaceId", algorithm: "btree", columns: ["workspaceId"] }],
    },
    {
      id: t.string().primaryKey(),
      workspaceId: t.string(),
      name: t.string(),
      createdAt: t.string(),
      updatedAt: t.string(),
      lastModifiedBy: t.string(),
    },
  ),

  workflowNode: table(
    {
      name: "workflow_node",
      public: true,
      indexes: [{ accessor: "byWorkflowId", algorithm: "btree", columns: ["workflowId"] }],
    },
    {
      workflowId: t.string(),
      nodeId: t.string(),
      type: t.string(),
      positionJson: t.string(),
      dataJson: t.string(),
      updatedAt: t.string(),
      updatedBy: t.string(),
    },
  ),

  workflowEdge: table(
    {
      name: "workflow_edge",
      public: true,
      indexes: [{ accessor: "byWorkflowId", algorithm: "btree", columns: ["workflowId"] }],
    },
    {
      workflowId: t.string(),
      edgeId: t.string(),
      source: t.string(),
      target: t.string(),
      handlesJson: t.string(),
      dataJson: t.string(),
      updatedAt: t.string(),
      updatedBy: t.string(),
    },
  ),

  workflowUiState: table(
    { name: "workflow_ui_state", public: true },
    {
      workflowId: t.string().primaryKey(),
      uiStateJson: t.string(),
    },
  ),

  brainDoc: table(
    {
      name: "brain_doc",
      public: true,
      indexes: [{ accessor: "byWorkspaceId", algorithm: "btree", columns: ["workspaceId"] }],
    },
    {
      id: t.string().primaryKey(),
      workspaceId: t.string(),
      title: t.string(),
      contentJson: t.string(),
      createdAt: t.string(),
      updatedAt: t.string(),
      deletedAt: t.string().optional(),
    },
  ),

  brainDocVersion: table(
    {
      name: "brain_doc_version",
      public: true,
      indexes: [{ accessor: "byDocId", algorithm: "btree", columns: ["docId"] }],
    },
    {
      docId: t.string(),
      versionId: t.string(),
      contentJson: t.string(),
      createdAt: t.string(),
    },
  ),

  brainFeedback: table(
    {
      name: "brain_feedback",
      public: true,
      indexes: [{ accessor: "byDocId", algorithm: "btree", columns: ["docId"] }],
    },
    {
      docId: t.string(),
      identity: t.identity(),
      type: t.string(),
      comment: t.string(),
      createdAt: t.string(),
    },
  ),

  workflowChangeEvent: table(
    {
      name: "workflow_change_event",
      public: true,
      indexes: [{ accessor: "byWorkflowId", algorithm: "btree", columns: ["workflowId"] }],
    },
    {
      workflowId: t.string(),
      eventType: t.string(),
      nodeId: t.string().optional(),
      details: t.string(),
      timestamp: t.string(),
    },
  ),

  presence: table(
    {
      name: "presence",
      public: true,
      indexes: [
        { accessor: "byWorkspaceId", algorithm: "btree", columns: ["workspaceId"] },
        { accessor: "byIdentity", algorithm: "btree", columns: ["identity"] },
      ],
    },
    {
      workspaceId: t.string(),
      workflowId: t.string(),
      identity: t.identity(),
      displayName: t.string(),
      selectedNodeId: t.string().optional(),
      lastSeenAt: t.string(),
    },
  ),
});

export default spacetimedb;

type Db = Parameters<Parameters<typeof spacetimedb.reducer>[1]>[0]["db"];

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

const nowIso = () => new Date().toISOString();

function findMember(db: Db, workspaceId: string, identity: Identity) {
  for (const member of db.workspaceMember.byWorkspaceId.filter(workspaceId)) {
    if (member.identity.isEqual(identity)) return member;
  }
  return null;
}

function requireMembership(db: Db, workspaceId: string, identity: Identity) {
  const member = findMember(db, workspaceId, identity);
  if (!member) throw new Error(`Not a member of workspace ${workspaceId}`);
  return member;
}

function deleteWorkflowData(db: Db, workflowId: string): void {
  db.workflowNode.byWorkflowId.delete(workflowId);
  db.workflowEdge.byWorkflowId.delete(workflowId);
  db.workflowChangeEvent.byWorkflowId.delete(workflowId);
  db.workflowUiState.workflowId.delete(workflowId);
}

export const init = spacetimedb.init(() => {});

export const onConnect = spacetimedb.clientConnected(() => {});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  for (const row of ctx.db.presence.byIdentity.filter(ctx.sender)) {
    ctx.db.presence.delete(row);
  }
});

export const createWorkspace = spacetimedb.reducer(
  { id: t.string(), name: t.string(), displayName: t.string() },
  (ctx, { id, name, displayName }) => {
    const now = nowIso();
    ctx.db.workspace.insert({ id, name, createdAt: now, updatedAt: now });
    ctx.db.workspaceMember.insert({
      workspaceId: id,
      identity: ctx.sender,
      displayName,
      role: "owner",
      joinedAt: now,
    });
  },
);

export const renameWorkspace = spacetimedb.reducer(
  { workspaceId: t.string(), newName: t.string() },
  (ctx, { workspaceId, newName }) => {
    requireMembership(ctx.db, workspaceId, ctx.sender);
    const ws = ctx.db.workspace.id.find(workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    ctx.db.workspace.id.update({ ...ws, name: newName, updatedAt: nowIso() });
  },
);

export const deleteWorkspace = spacetimedb.reducer({ workspaceId: t.string() }, (ctx, { workspaceId }) => {
  const member = requireMembership(ctx.db, workspaceId, ctx.sender);
  if (member.role !== "owner") throw new Error("Only owners can delete workspaces");

  for (const wf of ctx.db.workflow.byWorkspaceId.filter(workspaceId)) {
    deleteWorkflowData(ctx.db, wf.id);
    ctx.db.workflow.delete(wf);
  }
  ctx.db.workspaceMember.byWorkspaceId.delete(workspaceId);
  ctx.db.workspaceInvite.byWorkspaceId.delete(workspaceId);
  for (const doc of ctx.db.brainDoc.byWorkspaceId.filter(workspaceId)) {
    ctx.db.brainDocVersion.byDocId.delete(doc.id);
    ctx.db.brainFeedback.byDocId.delete(doc.id);
    ctx.db.brainDoc.delete(doc);
  }
  ctx.db.presence.byWorkspaceId.delete(workspaceId);
  ctx.db.workspace.id.delete(workspaceId);
});

export const createInvite = spacetimedb.reducer(
  { workspaceId: t.string(), tokenHash: t.string() },
  (ctx, { workspaceId, tokenHash }) => {
    requireMembership(ctx.db, workspaceId, ctx.sender);
    ctx.db.workspaceInvite.insert({ workspaceId, tokenHash, createdAt: nowIso(), revokedAt: undefined });
  },
);

export const joinWorkspace = spacetimedb.reducer(
  { tokenHash: t.string(), displayName: t.string() },
  (ctx, { tokenHash, displayName }) => {
    const invite = [...ctx.db.workspaceInvite.byTokenHash.filter(tokenHash)].find(inv => inv.revokedAt === undefined);
    if (!invite) throw new Error("Invalid or revoked invite token");
    if (findMember(ctx.db, invite.workspaceId, ctx.sender)) return;
    ctx.db.workspaceMember.insert({
      workspaceId: invite.workspaceId,
      identity: ctx.sender,
      displayName,
      role: "editor",
      joinedAt: nowIso(),
    });
  },
);

export const createWorkflow = spacetimedb.reducer(
  { id: t.string(), workspaceId: t.string(), name: t.string(), displayName: t.string() },
  (ctx, { id, workspaceId, name, displayName }) => {
    requireMembership(ctx.db, workspaceId, ctx.sender);
    const now = nowIso();
    ctx.db.workflow.insert({ id, workspaceId, name, createdAt: now, updatedAt: now, lastModifiedBy: displayName });
  },
);

export const renameWorkflow = spacetimedb.reducer(
  { workflowId: t.string(), newName: t.string() },
  (ctx, { workflowId, newName }) => {
    const wf = ctx.db.workflow.id.find(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);
    requireMembership(ctx.db, wf.workspaceId, ctx.sender);
    ctx.db.workflow.id.update({ ...wf, name: newName, updatedAt: nowIso() });
  },
);

export const deleteWorkflow = spacetimedb.reducer({ workflowId: t.string() }, (ctx, { workflowId }) => {
  const wf = ctx.db.workflow.id.find(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  requireMembership(ctx.db, wf.workspaceId, ctx.sender);
  deleteWorkflowData(ctx.db, workflowId);
  ctx.db.workflow.delete(wf);
});

export const applyWorkflowOps = spacetimedb.reducer(
  { workflowId: t.string(), opsJson: t.string(), displayName: t.string() },
  (ctx, { workflowId, opsJson, displayName }) => {
    const wf = ctx.db.workflow.id.find(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);
    requireMembership(ctx.db, wf.workspaceId, ctx.sender);
    const ops = JSON.parse(opsJson) as WorkflowOp[];
    const now = nowIso();

    for (const op of ops) {
      if (op.op === "upsert_node") {
        const existing = [...ctx.db.workflowNode.byWorkflowId.filter(workflowId)].find(n => n.nodeId === op.nodeId);
        if (existing) ctx.db.workflowNode.delete(existing);
        ctx.db.workflowNode.insert({
          workflowId,
          nodeId: op.nodeId!,
          type: op.type!,
          positionJson: op.positionJson!,
          dataJson: op.dataJson!,
          updatedAt: now,
          updatedBy: displayName,
        });
        if (!existing) {
          ctx.db.workflowChangeEvent.insert({
            workflowId,
            eventType: "node_added",
            nodeId: op.nodeId!,
            details: JSON.stringify({ nodeName: op.type, by: displayName }),
            timestamp: now,
          });
        }
      } else if (op.op === "delete_node") {
        const node = [...ctx.db.workflowNode.byWorkflowId.filter(workflowId)].find(n => n.nodeId === op.nodeId);
        if (node) {
          ctx.db.workflowNode.delete(node);
          ctx.db.workflowChangeEvent.insert({
            workflowId,
            eventType: "node_deleted",
            nodeId: op.nodeId!,
            details: JSON.stringify({ nodeName: node.type, by: displayName }),
            timestamp: now,
          });
        }
      } else if (op.op === "upsert_edge") {
        const existing = [...ctx.db.workflowEdge.byWorkflowId.filter(workflowId)].find(e => e.edgeId === op.edgeId);
        if (existing) ctx.db.workflowEdge.delete(existing);
        ctx.db.workflowEdge.insert({
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
          ctx.db.workflowChangeEvent.insert({
            workflowId,
            eventType: "edge_added",
            nodeId: undefined,
            details: JSON.stringify({ edgeId: op.edgeId, by: displayName }),
            timestamp: now,
          });
        }
      } else if (op.op === "delete_edge") {
        const edge = [...ctx.db.workflowEdge.byWorkflowId.filter(workflowId)].find(e => e.edgeId === op.edgeId);
        if (edge) {
          ctx.db.workflowEdge.delete(edge);
          ctx.db.workflowChangeEvent.insert({
            workflowId,
            eventType: "edge_deleted",
            nodeId: undefined,
            details: JSON.stringify({ edgeId: op.edgeId, by: displayName }),
            timestamp: now,
          });
        }
      }
    }

    ctx.db.workflow.id.update({ ...wf, updatedAt: now, lastModifiedBy: displayName });
  },
);

export const updateWorkflowUiState = spacetimedb.reducer(
  { workflowId: t.string(), uiStateJson: t.string() },
  (ctx, { workflowId, uiStateJson }) => {
    const wf = ctx.db.workflow.id.find(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);
    requireMembership(ctx.db, wf.workspaceId, ctx.sender);
    const existing = ctx.db.workflowUiState.workflowId.find(workflowId);
    if (existing) ctx.db.workflowUiState.workflowId.update({ ...existing, uiStateJson });
    else ctx.db.workflowUiState.insert({ workflowId, uiStateJson });
  },
);

export const saveBrainDoc = spacetimedb.reducer(
  {
    id: t.string(),
    workspaceId: t.string(),
    title: t.string(),
    contentJson: t.string(),
    versionId: t.string().optional(),
  },
  (ctx, { id, workspaceId, title, contentJson, versionId }) => {
    requireMembership(ctx.db, workspaceId, ctx.sender);
    const now = nowIso();
    const existing = ctx.db.brainDoc.id.find(id);
    if (existing) {
      if (versionId) {
        ctx.db.brainDocVersion.insert({ docId: id, versionId, contentJson: existing.contentJson, createdAt: now });
      }
      ctx.db.brainDoc.id.update({ ...existing, title, contentJson, updatedAt: now, deletedAt: undefined });
    } else {
      ctx.db.brainDoc.insert({ id, workspaceId, title, contentJson, createdAt: now, updatedAt: now, deletedAt: undefined });
    }
  },
);

export const deleteBrainDoc = spacetimedb.reducer({ docId: t.string() }, (ctx, { docId }) => {
  const doc = ctx.db.brainDoc.id.find(docId);
  if (!doc) throw new Error(`Brain doc ${docId} not found`);
  requireMembership(ctx.db, doc.workspaceId, ctx.sender);
  ctx.db.brainDoc.id.update({ ...doc, deletedAt: nowIso() });
});

export const recordBrainView = spacetimedb.reducer({ docId: t.string() }, (ctx, { docId }) => {
  const doc = ctx.db.brainDoc.id.find(docId);
  if (!doc) throw new Error(`Brain doc ${docId} not found`);
  requireMembership(ctx.db, doc.workspaceId, ctx.sender);
  const content = JSON.parse(doc.contentJson);
  if (content.metrics) {
    content.metrics.views = (content.metrics.views || 0) + 1;
    content.metrics.lastViewedAt = nowIso();
  }
  ctx.db.brainDoc.id.update({ ...doc, contentJson: JSON.stringify(content) });
});

export const addBrainFeedback = spacetimedb.reducer(
  { docId: t.string(), type: t.string(), comment: t.string() },
  (ctx, { docId, type, comment }) => {
    const doc = ctx.db.brainDoc.id.find(docId);
    if (!doc) throw new Error(`Brain doc ${docId} not found`);
    requireMembership(ctx.db, doc.workspaceId, ctx.sender);
    ctx.db.brainFeedback.insert({ docId, identity: ctx.sender, type, comment, createdAt: nowIso() });
  },
);

export const restoreBrainDocVersion = spacetimedb.reducer(
  { docId: t.string(), versionId: t.string(), snapshotVersionId: t.string() },
  (ctx, { docId, versionId, snapshotVersionId }) => {
    const doc = ctx.db.brainDoc.id.find(docId);
    if (!doc) throw new Error(`Brain doc ${docId} not found`);
    requireMembership(ctx.db, doc.workspaceId, ctx.sender);
    const version = [...ctx.db.brainDocVersion.byDocId.filter(docId)].find(v => v.versionId === versionId);
    if (!version) throw new Error(`Version ${versionId} not found`);
    const now = nowIso();
    ctx.db.brainDocVersion.insert({ docId, versionId: snapshotVersionId, contentJson: doc.contentJson, createdAt: now });
    ctx.db.brainDoc.id.update({ ...doc, contentJson: version.contentJson, updatedAt: now, deletedAt: undefined });
  },
);

export const updatePresence = spacetimedb.reducer(
  {
    workspaceId: t.string(),
    workflowId: t.string(),
    displayName: t.string(),
    selectedNodeId: t.string().optional(),
  },
  (ctx, { workspaceId, workflowId, displayName, selectedNodeId }) => {
    const existing = [...ctx.db.presence.byIdentity.filter(ctx.sender)].find(
      p => p.workspaceId === workspaceId && p.workflowId === workflowId,
    );
    if (existing) ctx.db.presence.delete(existing);
    ctx.db.presence.insert({
      workspaceId,
      workflowId,
      identity: ctx.sender,
      displayName,
      selectedNodeId,
      lastSeenAt: nowIso(),
    });
  },
);

export const importWorkspace = spacetimedb.reducer(
  { id: t.string(), name: t.string(), createdAt: t.string(), updatedAt: t.string(), displayName: t.string() },
  (ctx, { id, name, createdAt, updatedAt, displayName }) => {
    if (ctx.db.workspace.id.find(id)) return;
    ctx.db.workspace.insert({ id, name, createdAt, updatedAt });
    ctx.db.workspaceMember.insert({ workspaceId: id, identity: ctx.sender, displayName, role: "owner", joinedAt: nowIso() });
  },
);

export const importWorkflowSnapshot = spacetimedb.reducer(
  {
    workflowId: t.string(),
    workspaceId: t.string(),
    name: t.string(),
    nodesJson: t.string(),
    edgesJson: t.string(),
    uiStateJson: t.string(),
    createdAt: t.string(),
    updatedAt: t.string(),
    lastModifiedBy: t.string(),
  },
  (ctx, { workflowId, workspaceId, name, nodesJson, edgesJson, uiStateJson, createdAt, updatedAt, lastModifiedBy }) => {
    if (ctx.db.workflow.id.find(workflowId)) return;
    requireMembership(ctx.db, workspaceId, ctx.sender);
    ctx.db.workflow.insert({ id: workflowId, workspaceId, name, createdAt, updatedAt, lastModifiedBy });

    const nodes = JSON.parse(nodesJson) as Array<{ nodeId: string; type: string; positionJson: string; dataJson: string }>;
    for (const node of nodes) {
      ctx.db.workflowNode.insert({ workflowId, ...node, updatedAt, updatedBy: lastModifiedBy });
    }

    const edges = JSON.parse(edgesJson) as Array<{
      edgeId: string;
      source: string;
      target: string;
      handlesJson: string;
      dataJson: string;
    }>;
    for (const edge of edges) {
      ctx.db.workflowEdge.insert({ workflowId, ...edge, updatedAt, updatedBy: lastModifiedBy });
    }

    if (uiStateJson !== "{}") ctx.db.workflowUiState.insert({ workflowId, uiStateJson });
  },
);

export const importBrainDoc = spacetimedb.reducer(
  {
    id: t.string(),
    workspaceId: t.string(),
    title: t.string(),
    contentJson: t.string(),
    createdAt: t.string(),
    updatedAt: t.string(),
  },
  (ctx, { id, workspaceId, title, contentJson, createdAt, updatedAt }) => {
    requireMembership(ctx.db, workspaceId, ctx.sender);
    if (ctx.db.brainDoc.id.find(id)) return;
    ctx.db.brainDoc.insert({ id, workspaceId, title, contentJson, createdAt, updatedAt, deletedAt: undefined });
  },
);

/**
 * SpacetimeDB Workspace Sync Bridge
 *
 * Bidirectional sync between SpacetimeDB table subscriptions and the Zustand
 * workflow store. Mirrors the _isApplyingRemote loop-prevention pattern from
 * collab-doc.ts.
 *
 * Flow:
 *   Remote row change → set _isApplyingRemote → update Zustand → clear flag
 *   Zustand change    → check flag → skip if remote → else call reducer
 */

"use client";

import throttle from "lodash.throttle";
import { useWorkflowStore } from "@/store/workflow";
import { useCollabStore } from "@/store/collaboration/collab-store";
import { getSpacetimeClient } from "./client";
import { WorkflowNodeType } from "@/types/workflow";
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";
import type {
  SpacetimeWorkflowNode,
  SpacetimeWorkflowEdge,
  WorkflowOp,
} from "./types";
import type { SubscriptionHandle } from "./module_bindings";
import type {
  Workflow as BindingWorkflow,
  WorkflowNode as BindingWorkflowNode,
  WorkflowEdge as BindingWorkflowEdge,
} from "./module_bindings/types";
import {
  spacetimeNodeToWorkflowNode,
  spacetimeEdgeToWorkflowEdge,
  workflowNodeToOp,
  workflowEdgeToOp,
} from "./types";

// ── Transient property stripper (mirrors collab-doc.ts) ────────────────────

function cleanNodeForSync(node: WorkflowNode): WorkflowNode {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { measured, selected, dragging, deletable, ...rest } = node;

  if (rest.data?.type === WorkflowNodeType.SubWorkflow && rest.data.subNodes) {
    return {
      ...rest,
      data: {
        ...rest.data,
        subNodes: (rest.data.subNodes as WorkflowNode[]).map(cleanNodeForSync),
        subEdges: (rest.data.subEdges as WorkflowEdge[]).map(cleanEdgeForSync),
      },
    } as WorkflowNode;
  }

  return rest as WorkflowNode;
}

function cleanEdgeForSync(edge: WorkflowEdge): WorkflowEdge {
  const { type: _type, style: _style, animated: _animated, selected: _selected, ...rest } = edge;
  return rest as WorkflowEdge;
}

// ── Module-level mutex (mirrors collab-doc.ts pattern) ─────────────────────

let _isApplyingRemote = false;

// ── Workspace Sync Bridge ──────────────────────────────────────────────────

class SpacetimeWorkspaceSync {
  private _workspaceId: string | null = null;
  private _workflowId: string | null = null;
  private _storeUnsub: (() => void) | null = null;
  private _connectionUnsub: (() => void) | null = null;
  private _subscription: SubscriptionHandle | null = null;
  private _tableUnsubs: Array<() => void> = [];
  private _displayName = "Anonymous";
  private _active = false;

  // Reference cache — avoids sending reducer calls when nothing changed
  private _lastSyncedNodes: WorkflowNode[] = [];
  private _lastSyncedEdges: WorkflowEdge[] = [];
  private _lastSyncedName = "";

  // Batch queue for coalescing rapid changes
  private _pendingOps: WorkflowOp[] = [];
  private _flushThrottled = throttle(() => this._flushOps(), 200);

  // ── Public API ─────────────────────────────────────────────────────────

  isActive(): boolean {
    return this._active;
  }

  startSync(workspaceId: string, workflowId: string, displayName?: string): void {
    if (this._active) this.stopSync();

    this._workspaceId = workspaceId;
    this._workflowId = workflowId;
    this._displayName = displayName ?? "Anonymous";
    this._active = true;

    const client = getSpacetimeClient();

    this._connectionUnsub = client.onStateChange((state) => {
      if (useCollabStore.getState().syncBackend === "yjs") return;
      useCollabStore.getState()._setSyncBackend("spacetimedb");
      useCollabStore.getState()._setConnected(state === "connected");
      useCollabStore.getState()._setInitializing(state === "connecting");
    });

    // Connect if not already
    if (!client.isConnected) {
      if (useCollabStore.getState().syncBackend !== "yjs") {
        useCollabStore.getState()._setSyncBackend("spacetimedb");
        useCollabStore.getState()._setInitializing(true);
      }
      client.connect();
    }

    // Wait for connection, then subscribe
    if (client.isConnected) {
      this._setupSubscriptions();
    } else {
      const unsub = client.onStateChange((state) => {
        if (state === "connected") {
          unsub();
          this._setupSubscriptions();
        }
      });
    }

    // Subscribe to Zustand store changes → SpacetimeDB
    this._storeUnsub = useWorkflowStore.subscribe((state) => {
      if (_isApplyingRemote) return;
      if (!this._active) return;

      const nodesChanged = state.nodes !== this._lastSyncedNodes;
      const edgesChanged = state.edges !== this._lastSyncedEdges;
      const nameChanged = state.name !== this._lastSyncedName;

      if (!nodesChanged && !edgesChanged && !nameChanged) return;

      // Diff and queue operations
      if (nodesChanged) {
        this._diffNodes(this._lastSyncedNodes, state.nodes);
      }
      if (edgesChanged) {
        this._diffEdges(this._lastSyncedEdges, state.edges);
      }
      if (nameChanged && this._workflowId) {
        try {
          void getSpacetimeClient()
            .callReducer("rename_workflow", [
              this._workflowId,
              state.name,
            ])
            .catch(() => {
              // Ignore if not connected
            });
        } catch {
          // Ignore if not connected
        }
      }

      this._lastSyncedNodes = state.nodes;
      this._lastSyncedEdges = state.edges;
      this._lastSyncedName = state.name;

      this._flushThrottled();
    });
  }

  stopSync(): void {
    this._active = false;

    this._storeUnsub?.();
    this._storeUnsub = null;

    this._connectionUnsub?.();
    this._connectionUnsub = null;

    this._teardownSubscriptions();

    this._flushThrottled.cancel();
    this._pendingOps = [];

    this._lastSyncedNodes = [];
    this._lastSyncedEdges = [];
    this._lastSyncedName = "";

    this._workspaceId = null;
    this._workflowId = null;

    if (useCollabStore.getState().syncBackend !== "yjs") {
      useCollabStore.getState()._setConnected(false);
      useCollabStore.getState()._setInitializing(false);
      useCollabStore.getState()._setSyncBackend(null);
    }
  }

  // ── Private: Subscription Setup ────────────────────────────────────────

  private _setupSubscriptions(): void {
    const client = getSpacetimeClient();
    const connection = client.connection;
    if (!connection) return;

    this._teardownSubscriptions();
    this._registerTableListeners(connection);

    // Subscribe to relevant tables
    this._subscription = client.subscribe(
      [
        `SELECT * FROM workflow WHERE workspace_id = '${this._workspaceId}'`,
        `SELECT * FROM workflow_node WHERE workflow_id = '${this._workflowId}'`,
        `SELECT * FROM workflow_edge WHERE workflow_id = '${this._workflowId}'`,
        `SELECT * FROM workflow_ui_state WHERE workflow_id = '${this._workflowId}'`,
        `SELECT * FROM workflow_change_event WHERE workflow_id = '${this._workflowId}'`,
        `SELECT * FROM workspace_member WHERE workspace_id = '${this._workspaceId}'`,
      ],
      () => this._syncFromCache(connection),
    );

    if (useCollabStore.getState().syncBackend !== "yjs") {
      useCollabStore.getState()._setSyncBackend("spacetimedb");
      useCollabStore.getState()._setConnected(true);
      useCollabStore.getState()._setInitializing(false);
    }

    // Initialize reference cache from current store state
    const state = useWorkflowStore.getState();
    this._lastSyncedNodes = state.nodes;
    this._lastSyncedEdges = state.edges;
    this._lastSyncedName = state.name;
  }

  private _teardownSubscriptions(): void {
    if (this._subscription && !this._subscription.isEnded()) {
      this._subscription.unsubscribe();
    }
    this._subscription = null;

    for (const unsub of this._tableUnsubs) {
      unsub();
    }
    this._tableUnsubs = [];
  }

  private _registerTableListeners(connection: NonNullable<ReturnType<typeof getSpacetimeClient>["connection"]>): void {
    const onNodeInsert = (_ctx: unknown, row: BindingWorkflowNode) => this._upsertRemoteNode(row);
    const onNodeUpdate = (_ctx: unknown, _oldRow: BindingWorkflowNode, row: BindingWorkflowNode) => this._upsertRemoteNode(row);
    const onNodeDelete = (_ctx: unknown, row: BindingWorkflowNode) => this._deleteRemoteNode(row);
    const onEdgeInsert = (_ctx: unknown, row: BindingWorkflowEdge) => this._upsertRemoteEdge(row);
    const onEdgeUpdate = (_ctx: unknown, _oldRow: BindingWorkflowEdge, row: BindingWorkflowEdge) => this._upsertRemoteEdge(row);
    const onEdgeDelete = (_ctx: unknown, row: BindingWorkflowEdge) => this._deleteRemoteEdge(row);
    const onWorkflowInsert = (_ctx: unknown, row: BindingWorkflow) => this._upsertRemoteWorkflow(row);
    const onWorkflowUpdate = (_ctx: unknown, _oldRow: BindingWorkflow, row: BindingWorkflow) => this._upsertRemoteWorkflow(row);

    connection.db.workflowNode.onInsert(onNodeInsert);
    connection.db.workflowNode.onUpdate?.(onNodeUpdate);
    connection.db.workflowNode.onDelete(onNodeDelete);
    connection.db.workflowEdge.onInsert(onEdgeInsert);
    connection.db.workflowEdge.onUpdate?.(onEdgeUpdate);
    connection.db.workflowEdge.onDelete(onEdgeDelete);
    connection.db.workflow.onInsert(onWorkflowInsert);
    connection.db.workflow.onUpdate?.(onWorkflowUpdate);

    this._tableUnsubs.push(
      () => connection.db.workflowNode.removeOnInsert(onNodeInsert),
      () => connection.db.workflowNode.removeOnUpdate?.(onNodeUpdate),
      () => connection.db.workflowNode.removeOnDelete(onNodeDelete),
      () => connection.db.workflowEdge.removeOnInsert(onEdgeInsert),
      () => connection.db.workflowEdge.removeOnUpdate?.(onEdgeUpdate),
      () => connection.db.workflowEdge.removeOnDelete(onEdgeDelete),
      () => connection.db.workflow.removeOnInsert(onWorkflowInsert),
      () => connection.db.workflow.removeOnUpdate?.(onWorkflowUpdate),
    );
  }

  private _syncFromCache(connection: NonNullable<ReturnType<typeof getSpacetimeClient>["connection"]>): void {
    if (!this._active) return;

    const nodes = Array.from(connection.db.workflowNode.iter())
      .filter((row) => row.workflowId === this._workflowId)
      .map((row) => spacetimeNodeToWorkflowNode(row as SpacetimeWorkflowNode));
    const edges = Array.from(connection.db.workflowEdge.iter())
      .filter((row) => row.workflowId === this._workflowId)
      .map((row) => spacetimeEdgeToWorkflowEdge(row as SpacetimeWorkflowEdge));
    const workflow = Array.from(connection.db.workflow.iter()).find((row) => row.id === this._workflowId);

    this._applyRemoteGraphChange(nodes, edges);
    if (workflow && workflow.name !== this._lastSyncedName) {
      this._applyRemoteNameChange(workflow.name);
    }
  }

  private _upsertRemoteNode(row: BindingWorkflowNode): void {
    if (!this._active || row.workflowId !== this._workflowId) return;

    const currentNodes = new Map(this._lastSyncedNodes.map((node) => [node.id, node]));
    currentNodes.set(row.nodeId, spacetimeNodeToWorkflowNode(row as SpacetimeWorkflowNode));
    this._applyRemoteGraphChange(Array.from(currentNodes.values()), null);
  }

  private _deleteRemoteNode(row: BindingWorkflowNode): void {
    if (!this._active || row.workflowId !== this._workflowId) return;

    const currentNodes = new Map(this._lastSyncedNodes.map((node) => [node.id, node]));
    currentNodes.delete(row.nodeId);
    this._applyRemoteGraphChange(Array.from(currentNodes.values()), null);
  }

  private _upsertRemoteEdge(row: BindingWorkflowEdge): void {
    if (!this._active || row.workflowId !== this._workflowId) return;

    const currentEdges = new Map(this._lastSyncedEdges.map((edge) => [edge.id, edge]));
    currentEdges.set(row.edgeId, spacetimeEdgeToWorkflowEdge(row as SpacetimeWorkflowEdge));
    this._applyRemoteGraphChange(null, Array.from(currentEdges.values()));
  }

  private _deleteRemoteEdge(row: BindingWorkflowEdge): void {
    if (!this._active || row.workflowId !== this._workflowId) return;

    const currentEdges = new Map(this._lastSyncedEdges.map((edge) => [edge.id, edge]));
    currentEdges.delete(row.edgeId);
    this._applyRemoteGraphChange(null, Array.from(currentEdges.values()));
  }

  private _upsertRemoteWorkflow(row: BindingWorkflow): void {
    if (!this._active || row.id !== this._workflowId || row.name === this._lastSyncedName) return;
    this._applyRemoteNameChange(row.name);
  }

  // ── Private: Apply remote changes to Zustand (with loop prevention) ────

  private _applyRemoteGraphChange(
    nodes: WorkflowNode[] | null,
    edges: WorkflowEdge[] | null,
  ): void {
    _isApplyingRemote = true;

    try {
      const temporal = useWorkflowStore.temporal.getState();
      temporal.pause();

      const patch: Partial<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }> = {};

      if (nodes) {
        patch.nodes = nodes;
        this._lastSyncedNodes = nodes;
      }
      if (edges) {
        patch.edges = edges;
        this._lastSyncedEdges = edges;
      }

      useWorkflowStore.setState(patch);

      queueMicrotask(() => {
        temporal.resume();
        _isApplyingRemote = false;
      });
    } catch {
      _isApplyingRemote = false;
    }
  }

  private _applyRemoteNameChange(name: string): void {
    _isApplyingRemote = true;

    try {
      this._lastSyncedName = name;
      useWorkflowStore.setState({ name });

      queueMicrotask(() => {
        _isApplyingRemote = false;
      });
    } catch {
      _isApplyingRemote = false;
    }
  }

  // ── Private: Diff local changes into batch operations ──────────────────

  private _diffNodes(prev: WorkflowNode[], next: WorkflowNode[]): void {
    const prevMap = new Map(prev.map((n) => [n.id, n]));
    const nextMap = new Map(next.map((n) => [n.id, n]));

    // Deleted nodes
    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) {
        this._pendingOps.push({ op: "delete_node", nodeId: id });
      }
    }

    // Added or changed nodes
    for (const [id, node] of nextMap) {
      const existing = prevMap.get(id);
      const cleaned = cleanNodeForSync(node);
      if (!existing || JSON.stringify(cleanNodeForSync(existing)) !== JSON.stringify(cleaned)) {
        this._pendingOps.push(workflowNodeToOp(cleaned));
      }
    }
  }

  private _diffEdges(prev: WorkflowEdge[], next: WorkflowEdge[]): void {
    const prevMap = new Map(prev.map((e) => [e.id, e]));
    const nextMap = new Map(next.map((e) => [e.id, e]));

    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) {
        this._pendingOps.push({ op: "delete_edge", edgeId: id });
      }
    }

    for (const [id, edge] of nextMap) {
      const existing = prevMap.get(id);
      const cleaned = cleanEdgeForSync(edge);
      if (!existing || JSON.stringify(cleanEdgeForSync(existing)) !== JSON.stringify(cleaned)) {
        this._pendingOps.push(workflowEdgeToOp(cleaned));
      }
    }
  }

  // ── Private: Flush batched operations to SpacetimeDB ───────────────────

  private _flushOps(): void {
    if (this._pendingOps.length === 0 || !this._workflowId) return;

    const ops = this._pendingOps.splice(0);

    try {
      void getSpacetimeClient()
        .callReducer("apply_workflow_ops", [
          this._workflowId,
          JSON.stringify(ops),
          this._displayName,
        ])
        .catch(() => {
          // If not connected, ops are lost — they'll be re-synced on reconnect
        });
    } catch {
      // If not connected, ops are lost — they'll be re-synced on reconnect
    }
  }
}

// ── Module-level singleton ─────────────────────────────────────────────────

export const spacetimeWorkspaceSync = new SpacetimeWorkspaceSync();

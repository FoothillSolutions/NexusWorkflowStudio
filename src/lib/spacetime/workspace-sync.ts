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
  private _messageHandler: ((event: MessageEvent) => void) | null = null;
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

    // Track connection state in the collab store
    useCollabStore.getState()._setSyncBackend("spacetimedb");
    this._connectionUnsub = client.onStateChange((state) => {
      useCollabStore.getState()._setConnected(state === "connected");
      useCollabStore.getState()._setInitializing(state === "connecting");
    });

    // Connect if not already
    if (!client.isConnected) {
      useCollabStore.getState()._setInitializing(true);
      client.connect();
    }

    // Set up message handler for row updates
    this._messageHandler = (event: MessageEvent) => {
      this._onMessage(event);
    };

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
          getSpacetimeClient().callReducer("rename_workflow", [
            this._workflowId,
            state.name,
          ]);
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

    if (this._messageHandler) {
      const ws = getSpacetimeClient().connection;
      if (ws) {
        ws.removeEventListener("message", this._messageHandler);
      }
      this._messageHandler = null;
    }

    this._flushThrottled.cancel();
    this._pendingOps = [];

    this._lastSyncedNodes = [];
    this._lastSyncedEdges = [];
    this._lastSyncedName = "";

    this._workspaceId = null;
    this._workflowId = null;

    useCollabStore.getState()._setConnected(false);
    useCollabStore.getState()._setInitializing(false);
    useCollabStore.getState()._setSyncBackend(null);
  }

  // ── Private: Subscription Setup ────────────────────────────────────────

  private _setupSubscriptions(): void {
    const client = getSpacetimeClient();
    const ws = client.connection;
    if (!ws) return;

    // Listen for row update messages
    if (this._messageHandler) {
      ws.addEventListener("message", this._messageHandler);
    }

    // Subscribe to relevant tables
    client.subscribe([
      `SELECT * FROM workflow WHERE workspaceId = '${this._workspaceId}'`,
      `SELECT * FROM workflow_node WHERE workflowId = '${this._workflowId}'`,
      `SELECT * FROM workflow_edge WHERE workflowId = '${this._workflowId}'`,
      `SELECT * FROM workflow_ui_state WHERE workflowId = '${this._workflowId}'`,
      `SELECT * FROM workflow_change_event WHERE workflowId = '${this._workflowId}'`,
      `SELECT * FROM workspace_member WHERE workspaceId = '${this._workspaceId}'`,
    ]);

    useCollabStore.getState()._setConnected(true);
    useCollabStore.getState()._setInitializing(false);

    // Initialize reference cache from current store state
    const state = useWorkflowStore.getState();
    this._lastSyncedNodes = state.nodes;
    this._lastSyncedEdges = state.edges;
    this._lastSyncedName = state.name;
  }

  // ── Private: Handle incoming messages ──────────────────────────────────

  private _onMessage(event: MessageEvent): void {
    if (!this._active) return;

    try {
      const msg = JSON.parse(event.data as string);

      // Handle subscription_applied or transaction_update with row changes
      if (msg.type === "transaction_update" || msg.type === "subscription_applied") {
        const updates = msg.subscription_update?.table_updates ?? msg.table_updates ?? [];
        this._processTableUpdates(updates);
      }
    } catch {
      // Ignore non-JSON messages
    }
  }

  private _processTableUpdates(
    tableUpdates: Array<{
      table_name: string;
      inserts?: Array<Record<string, unknown>>;
      deletes?: Array<Record<string, unknown>>;
    }>,
  ): void {
    let nodesChanged = false;
    let edgesChanged = false;

    const currentNodes = new Map(
      this._lastSyncedNodes.map((n) => [n.id, n]),
    );
    const currentEdges = new Map(
      this._lastSyncedEdges.map((e) => [e.id, e]),
    );

    for (const update of tableUpdates) {
      switch (update.table_name) {
        case "workflow_node": {
          // Process deletes first
          for (const del of update.deletes ?? []) {
            const row = del as unknown as SpacetimeWorkflowNode;
            if (row.workflowId === this._workflowId) {
              currentNodes.delete(row.nodeId);
              nodesChanged = true;
            }
          }
          // Then inserts (which include updates)
          for (const ins of update.inserts ?? []) {
            const row = ins as unknown as SpacetimeWorkflowNode;
            if (row.workflowId === this._workflowId) {
              currentNodes.set(row.nodeId, spacetimeNodeToWorkflowNode(row));
              nodesChanged = true;
            }
          }
          break;
        }

        case "workflow_edge": {
          for (const del of update.deletes ?? []) {
            const row = del as unknown as SpacetimeWorkflowEdge;
            if (row.workflowId === this._workflowId) {
              currentEdges.delete(row.edgeId);
              edgesChanged = true;
            }
          }
          for (const ins of update.inserts ?? []) {
            const row = ins as unknown as SpacetimeWorkflowEdge;
            if (row.workflowId === this._workflowId) {
              currentEdges.set(row.edgeId, spacetimeEdgeToWorkflowEdge(row));
              edgesChanged = true;
            }
          }
          break;
        }

        case "workflow": {
          for (const ins of update.inserts ?? []) {
            const row = ins as unknown as { id: string; name: string };
            if (row.id === this._workflowId && row.name !== this._lastSyncedName) {
              this._applyRemoteNameChange(row.name);
            }
          }
          break;
        }
      }
    }

    if (nodesChanged || edgesChanged) {
      this._applyRemoteGraphChange(
        nodesChanged ? Array.from(currentNodes.values()) : null,
        edgesChanged ? Array.from(currentEdges.values()) : null,
      );
    }
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
      getSpacetimeClient().callReducer("apply_workflow_ops", [
        this._workflowId,
        JSON.stringify(ops),
        this._displayName,
      ]);
    } catch {
      // If not connected, ops are lost — they'll be re-synced on reconnect
    }
  }
}

// ── Module-level singleton ─────────────────────────────────────────────────

export const spacetimeWorkspaceSync = new SpacetimeWorkspaceSync();

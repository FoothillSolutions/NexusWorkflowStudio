import * as Y from "yjs";
import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import { toast } from "sonner";
import { useWorkflowStore } from "@/store/workflow";
import { useCollabStore } from "@/store/collaboration/collab-store";
import { useAwarenessStore } from "@/store/collaboration/awareness-store";
import { getOrCreateUserName, getColorForClientId } from "./awareness-names";
import { getCollabServerUrl } from "./config";
import type { WorkflowJSON, WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { WorkflowNodeType } from "@/types/workflow";
import type { KnowledgeDoc } from "@/types/knowledge";
import { getAllKnowledgeDocs, replaceAllKnowledgeDocs } from "@/lib/knowledge";
import { useKnowledgeStore } from "@/store/knowledge";

// ── Transient property stripper ───────────────────────────────────────────
// Mirrors persistence.ts cleanNode — strips React Flow runtime fields before
// writing into Y.js so peers don't receive ephemeral state.

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

// ── Awareness state shape ─────────────────────────────────────────────────

interface RemoteAwarenessState {
  user?: {
    name: string;
    color: string;
    colorLight: string;
  };
  selectedNodeId?: string | null;
}

// ── CollabDoc singleton ───────────────────────────────────────────────────

// Module-level mutex flag — prevents the Y.js→Zustand observer from
// triggering the Zustand→Y.js subscriber and causing an infinite loop.
let _isApplyingRemote = false;
let _isApplyingRemoteBrain = false;

export class CollabDoc {
  private static _instance: CollabDoc | null = null;

  private _ydoc: Y.Doc;
  private _provider: HocuspocusProvider | null = null;
  private _yNodes: Y.Map<WorkflowNode>;
  private _yEdges: Y.Map<WorkflowEdge>;
  private _yName: Y.Text;
  private _roomId: string | null = null;
  private _storeUnsub: (() => void) | null = null;

  // Reference cache — avoids writing to Y.js when nothing actually changed
  private _lastSyncedNodes: WorkflowNode[] = [];
  private _lastSyncedEdges: WorkflowEdge[] = [];
  private _lastSyncedName: string = "";

  private _yDocs: Y.Map<KnowledgeDoc>;
  private _lastSyncedDocs: KnowledgeDoc[] = [];
  private _brainStoreUnsub: (() => void) | null = null;

  // Track peers for join/leave toasts
  private _prevPeerNames = new Map<number, string>();

  private constructor() {
    this._ydoc = new Y.Doc();
    this._yNodes = this._ydoc.getMap<WorkflowNode>("nodes");
    this._yEdges = this._ydoc.getMap<WorkflowEdge>("edges");
    this._yName = this._ydoc.getText("name");
    this._yDocs = this._ydoc.getMap<KnowledgeDoc>("brain");
  }

  static getInstance(): CollabDoc | null {
    return CollabDoc._instance;
  }

  static getOrCreate(): CollabDoc {
    if (!CollabDoc._instance) {
      CollabDoc._instance = new CollabDoc();
    }
    return CollabDoc._instance;
  }

  start(roomId: string, initialState?: WorkflowJSON): void {
    if (typeof window === "undefined") return;

    if (this._provider) {
      if (this._roomId === roomId) return;
      this.destroy();
      CollabDoc._instance = new CollabDoc();
      CollabDoc._instance.start(roomId, initialState);
      return;
    }

    this._roomId = roomId;
    useCollabStore.getState()._setRoomId(roomId);
    useCollabStore.getState()._setSyncBackend("yjs");
    useCollabStore.getState()._setInitializing(true);

    // Set up self identity
    const selfName = getOrCreateUserName();
    const selfColors = getColorForClientId(this._ydoc.clientID);
    useAwarenessStore.getState()._setSelf(selfName, selfColors.color, selfColors.colorLight);

    this._provider = new HocuspocusProvider({
      url: getCollabServerUrl(),
      name: roomId,
      document: this._ydoc,
      onStatus: ({ status }) => {
        useCollabStore.getState()._setConnected(status === WebSocketStatus.Connected);
      },
      onSynced: ({ state }) => {
        if (state && initialState) {
          this._seedInitialState(initialState);
        } else if (state) {
          this._seedInitialBrainDocs();
        }

        if (state) {
          useCollabStore.getState()._setConnected(true);
          useCollabStore.getState()._setInitializing(false);
        }
      },
      onDisconnect: () => {
        useCollabStore.getState()._setConnected(false);
      },
      onAwarenessChange: () => {
        this._onAwarenessChange();
      },
    });

    this._provider.setAwarenessField("user", {
      name: selfName,
      color: selfColors.color,
      colorLight: selfColors.colorLight,
    });
    this._provider.setAwarenessField("selectedNodeId", null);

    // Register observers: Y.Doc changes → Zustand
    this._yNodes.observe(this._onRemoteChange);
    this._yEdges.observe(this._onRemoteChange);
    this._yName.observe(this._onRemoteChange);
    this._yDocs.observe(this._onRemoteBrainChange);

    // Register subscriber: Zustand changes → Y.Doc
    this._storeUnsub = useWorkflowStore.subscribe((state) => {
      if (_isApplyingRemote) return;

      const nodesChanged = state.nodes !== this._lastSyncedNodes;
      const edgesChanged = state.edges !== this._lastSyncedEdges;
      const nameChanged = state.name !== this._lastSyncedName;

      if (!nodesChanged && !edgesChanged && !nameChanged) return;

      this._lastSyncedNodes = state.nodes;
      this._lastSyncedEdges = state.edges;
      this._lastSyncedName = state.name;

      this._ydoc.transact(() => {
        if (nodesChanged) this._syncNodesToYjs(state.nodes);
        if (edgesChanged) this._syncEdgesToYjs(state.edges);
        if (nameChanged) this._syncNameToYjs(state.name);
      });
    });

    // Brain: Zustand knowledge store → Y.Doc
    this._brainStoreUnsub = useKnowledgeStore.subscribe((state) => {
      if (_isApplyingRemoteBrain) return;
      if (state.docs === this._lastSyncedDocs) return;

      this._lastSyncedDocs = state.docs;

      this._ydoc.transact(() => {
        this._syncDocsToYjs(state.docs);
      });
    });

  }

  /** Disconnect and clean up everything. */
  destroy(): void {
    this._storeUnsub?.();
    this._storeUnsub = null;

    this._yNodes.unobserve(this._onRemoteChange);
    this._yEdges.unobserve(this._onRemoteChange);
    this._yName.unobserve(this._onRemoteChange);

    this._brainStoreUnsub?.();
    this._brainStoreUnsub = null;
    this._yDocs.unobserve(this._onRemoteBrainChange);

    if (this._provider) {
      this._provider.destroy();
      this._provider = null;
    }

    this._ydoc.destroy();

    useCollabStore.getState()._setRoomId(null);
    useCollabStore.getState()._setConnected(false);
    useCollabStore.getState()._setInitializing(false);
    useCollabStore.getState()._setPeerCount(0);
    useCollabStore.getState()._setSyncBackend(null);
    useAwarenessStore.getState()._setPeers([]);

    CollabDoc._instance = null;
  }

  /** Update the local user's ephemeral awareness state. */
  updateAwareness(patch: { selectedNodeId?: string | null }): void {
    if (!this._provider) return;
    for (const [key, value] of Object.entries(patch)) {
      this._provider.setAwarenessField(key, value);
    }
  }

  get roomId(): string | null {
    return this._roomId;
  }

  // ── Private: sync Y.Map → Zustand ──────────────────────────────────────

  private _onRemoteChange = (): void => {
    if (_isApplyingRemote) return;
    _isApplyingRemote = true;

    try {
      const temporal = useWorkflowStore.temporal.getState();
      temporal.pause();

      const nodes = Array.from(this._yNodes.values());
      const edges = Array.from(this._yEdges.values());
      const name = this._yName.toString();

      // Update reference cache so the Zustand subscriber skips this tick
      this._lastSyncedNodes = nodes;
      this._lastSyncedEdges = edges;
      this._lastSyncedName = name;

      useWorkflowStore.setState({ nodes, edges, name });

      // Resume temporal after React has had a chance to batch the update
      queueMicrotask(() => {
        temporal.resume();
        _isApplyingRemote = false;
      });
    } catch {
      _isApplyingRemote = false;
    }
  };

  // ── Private: sync Zustand → Y.Map ──────────────────────────────────────

  private _syncNodesToYjs(nodes: WorkflowNode[]): void {
    const newIds = new Set(nodes.map((n) => n.id));

    // Remove deleted nodes
    for (const id of this._yNodes.keys()) {
      if (!newIds.has(id)) this._yNodes.delete(id);
    }

    // Upsert changed nodes
    for (const node of nodes) {
      const cleaned = cleanNodeForSync(node);
      const existing = this._yNodes.get(node.id);
      // Simple JSON comparison for change detection
      if (!existing || JSON.stringify(existing) !== JSON.stringify(cleaned)) {
        this._yNodes.set(node.id, cleaned);
      }
    }
  }

  private _syncEdgesToYjs(edges: WorkflowEdge[]): void {
    const newIds = new Set(edges.map((e) => e.id));

    for (const id of this._yEdges.keys()) {
      if (!newIds.has(id)) this._yEdges.delete(id);
    }

    for (const edge of edges) {
      const cleaned = cleanEdgeForSync(edge);
      const existing = this._yEdges.get(edge.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(cleaned)) {
        this._yEdges.set(edge.id, cleaned);
      }
    }
  }

  private _syncNameToYjs(name: string): void {
    const current = this._yName.toString();
    if (current !== name) {
      this._yName.delete(0, this._yName.length);
      this._yName.insert(0, name);
    }
  }

  // ── Private: sync Y.Map → Zustand (brain) ──────────────────────────────

  private _syncDocsToYjs(docs: KnowledgeDoc[]): void {
    const newIds = new Set(docs.map((d) => d.id));

    // Remove deleted docs
    for (const id of this._yDocs.keys()) {
      if (!newIds.has(id)) this._yDocs.delete(id);
    }

    // Upsert changed docs
    for (const doc of docs) {
      const existing = this._yDocs.get(doc.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(doc)) {
        this._yDocs.set(doc.id, doc);
      }
    }
  }

  private _onRemoteBrainChange = (): void => {
    if (_isApplyingRemoteBrain) return;
    _isApplyingRemoteBrain = true;

    try {
      const remoteDocs = Array.from(this._yDocs.values());

      // Update reference cache so the subscriber skips this tick
      this._lastSyncedDocs = remoteDocs;

      // Write-through: keep localStorage in sync with Y.Doc
      replaceAllKnowledgeDocs(remoteDocs);

      // Update Zustand state
      useKnowledgeStore.getState().refresh();

      queueMicrotask(() => {
        _isApplyingRemoteBrain = false;
      });
    } catch {
      _isApplyingRemoteBrain = false;
    }
  };

  // ── Private: awareness → peer store + toasts ───────────────────────────

  private _seedInitialState(initialState: WorkflowJSON): void {
    if (this._yNodes.size !== 0 || this._yEdges.size !== 0 || this._yName.length !== 0) return;

    this._ydoc.transact(() => {
      for (const node of initialState.nodes) {
        this._yNodes.set(node.id, cleanNodeForSync(node));
      }
      for (const edge of initialState.edges) {
        this._yEdges.set(edge.id, cleanEdgeForSync(edge));
      }
      this._yName.delete(0, this._yName.length);
      this._yName.insert(0, initialState.name);
    });

    this._lastSyncedNodes = initialState.nodes;
    this._lastSyncedEdges = initialState.edges;
    this._lastSyncedName = initialState.name;
    this._seedInitialBrainDocs();
  }

  private _seedInitialBrainDocs(): void {
    if (this._yDocs.size !== 0) return;

    const localDocs = getAllKnowledgeDocs();
    if (localDocs.length === 0) return;

    this._ydoc.transact(() => {
      for (const doc of localDocs) {
        this._yDocs.set(doc.id, doc);
      }
    });

    this._lastSyncedDocs = localDocs;
  }

  private _onAwarenessChange = (): void => {
    if (!this._provider) return;

    const allStates = this._provider.awareness?.getStates() as Map<number, RemoteAwarenessState & { clientId?: number }> | undefined;
    if (!allStates) return;

    const selfId = this._ydoc.clientID;

    const peers = [];
    const currentNames = new Map<number, string>();

    for (const [clientId, state] of allStates) {
      if (clientId === selfId || !state.user) continue;
      const colors = getColorForClientId(clientId);
      peers.push({
        clientId,
        user: {
          name: state.user.name,
          color: state.user.color ?? colors.color,
          colorLight: state.user.colorLight ?? colors.colorLight,
        },
        selectedNodeId: state.selectedNodeId ?? null,
      });
      currentNames.set(clientId, state.user.name);
    }

    // Join toasts
    for (const [id, name] of currentNames) {
      if (!this._prevPeerNames.has(id)) {
        toast(`${name} joined the session`);
      }
    }

    // Leave toasts
    for (const [id, name] of this._prevPeerNames) {
      if (!currentNames.has(id)) {
        toast(`${name} left the session`);
      }
    }

    this._prevPeerNames = currentNames;

    useAwarenessStore.getState()._setPeers(peers);
    useCollabStore.getState()._setPeerCount(peers.length);
  };
}

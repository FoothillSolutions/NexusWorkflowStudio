import * as Y from "yjs";
import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import { toast } from "sonner";
import { useWorkflowStore } from "@/store/workflow";
import { useCollabStore } from "@/store/collaboration/collab-store";
import { useAwarenessStore } from "@/store/collaboration/awareness-store";
import { getOrCreateUserName, getColorForClientId, saveUserName } from "./awareness-names";
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

export interface CursorPosition {
  x: number;
  y: number;
}

export interface KickRequest {
  targetClientId: number;
  at: number;
}

interface RemoteAwarenessState {
  user?: {
    name: string;
    color: string;
    colorLight: string;
  };
  selectedNodeId?: string | null;
  cursor?: CursorPosition | null;
  kickRequest?: KickRequest | null;
}

// How long to wait for initial connection before declaring failure.
const CONNECT_TIMEOUT_MS = 8000;

const OWNER_TOKEN_STORAGE_PREFIX = "nexus:collab-owner-token:";

function localOwnerTokenKey(roomId: string): string {
  return `${OWNER_TOKEN_STORAGE_PREFIX}${roomId}`;
}

function readLocalOwnerToken(roomId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(localOwnerTokenKey(roomId));
  } catch {
    return null;
  }
}

function writeLocalOwnerToken(roomId: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(localOwnerTokenKey(roomId), token);
  } catch {
    /* quota / private mode — ownership will silently not persist */
  }
}

function generateOwnerToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tok-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
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

  // Per-id reference cache — lets `_syncNodesToYjs` / `_syncEdgesToYjs` skip
  // unchanged items by identity, avoiding O(N) JSON.stringify on every drag
  // frame. React Flow updates only mutated nodes immutably, so ref-eq is a
  // reliable "nothing changed" signal.
  private _prevNodeRefs = new Map<string, WorkflowNode>();
  private _prevEdgeRefs = new Map<string, WorkflowEdge>();

  private _yDocs: Y.Map<KnowledgeDoc>;
  private _lastSyncedDocs: KnowledgeDoc[] = [];
  private _brainStoreUnsub: (() => void) | null = null;

  // Room-level metadata (ownerToken etc). Shared via Y.Doc so every peer
  // sees the same authoritative ownership record on the server.
  private _yMeta: Y.Map<string>;
  private _claimOwnershipOnSync = false;

  // Track peers for join/leave toasts
  private _prevPeerNames = new Map<number, string>();

  // Connect-watchdog — clears a stuck "Connecting…" state when the server
  // never responds (e.g. collab server not running).
  private _connectTimer: ReturnType<typeof setTimeout> | null = null;
  private _hasEverConnected = false;

  // Kick tracking — clientIds this session has already asked to kick, so a
  // single `kickRequest` stays in awareness without being re-broadcast.
  private _pendingKicks = new Map<number, number>();

  private _isKicked = false;

  private constructor() {
    this._ydoc = new Y.Doc();
    this._yNodes = this._ydoc.getMap<WorkflowNode>("nodes");
    this._yEdges = this._ydoc.getMap<WorkflowEdge>("edges");
    this._yName = this._ydoc.getText("name");
    this._yDocs = this._ydoc.getMap<KnowledgeDoc>("brain");
    this._yMeta = this._ydoc.getMap<string>("meta");
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

  start(
    roomId: string,
    initialState?: WorkflowJSON,
    opts: { asOwner?: boolean } = {},
  ): void {
    if (typeof window === "undefined") return;

    // Idempotency guard — if we're already running, bail out instead of
    // stacking a second provider + observers + store subscribers on top of
    // the existing ones (which would leak the originals until tab close).
    if (this._provider) {
      if (this._roomId !== roomId) {
        console.warn(
          `[collab] start("${roomId}") ignored — already connected to "${this._roomId}". Call destroy() first.`,
        );
      }
      return;
    }

    this._roomId = roomId;
    useCollabStore.getState()._setRoomId(roomId);
    useCollabStore.getState()._setInitializing(true);
    useCollabStore.getState()._setIsOwner(false);

    // If caller claims ownership, ensure a local owner token exists. We
    // stamp it onto Y.Doc `meta` once we've synced (so we don't overwrite a
    // prior owner). Peers who hold the matching localStorage token are
    // recognized as the owner across reloads.
    if (opts.asOwner && !readLocalOwnerToken(roomId)) {
      writeLocalOwnerToken(roomId, generateOwnerToken());
    }
    this._claimOwnershipOnSync = !!opts.asOwner;

    // Set up self identity
    const selfName = getOrCreateUserName();
    const selfColors = getColorForClientId(this._ydoc.clientID);
    useAwarenessStore
      .getState()
      ._setSelf(this._ydoc.clientID, selfName, selfColors.color, selfColors.colorLight);

    this._provider = new HocuspocusProvider({
      url: getCollabServerUrl(),
      name: roomId,
      document: this._ydoc,
      onStatus: ({ status }) => {
        const connected = status === WebSocketStatus.Connected;
        useCollabStore.getState()._setConnected(connected);
        if (connected) {
          this._hasEverConnected = true;
          // As soon as the socket is up we can stop showing "Connecting…".
          // onSynced will still run and seed state, but the UI should move on.
          useCollabStore.getState()._setInitializing(false);
          this._clearConnectTimer();
        }
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
          this._clearConnectTimer();
          this._claimOwnershipIfRequested();
          this._recomputeOwnerStatus();
        }
      },
      onDisconnect: () => {
        useCollabStore.getState()._setConnected(false);
        // If we never got a connection and the watchdog hasn't fired yet,
        // let it run — otherwise clear initializing so UI unsticks.
        if (this._hasEverConnected) {
          useCollabStore.getState()._setInitializing(false);
        }
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
    this._provider.setAwarenessField("cursor", null);
    this._provider.setAwarenessField("kickRequest", null);

    // Watchdog — if we still haven't connected after CONNECT_TIMEOUT_MS,
    // clear the initializing state and surface the problem so the UI stops
    // showing "Connecting…" forever.
    this._connectTimer = setTimeout(() => {
      if (this._hasEverConnected) return;
      useCollabStore.getState()._setInitializing(false);
      toast.error("Collaboration server unreachable — retrying in the background");
    }, CONNECT_TIMEOUT_MS);

    // Register observers: Y.Doc changes → Zustand
    this._yNodes.observe(this._onRemoteChange);
    this._yEdges.observe(this._onRemoteChange);
    this._yName.observe(this._onRemoteChange);
    this._yDocs.observe(this._onRemoteBrainChange);
    this._yMeta.observe(this._onMetaChange);

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

  private _clearConnectTimer(): void {
    if (this._connectTimer) {
      clearTimeout(this._connectTimer);
      this._connectTimer = null;
    }
  }

  /** Disconnect and clean up everything. */
  destroy(): void {
    this._clearConnectTimer();
    this._storeUnsub?.();
    this._storeUnsub = null;

    this._yNodes.unobserve(this._onRemoteChange);
    this._yEdges.unobserve(this._onRemoteChange);
    this._yName.unobserve(this._onRemoteChange);

    this._brainStoreUnsub?.();
    this._brainStoreUnsub = null;
    this._yDocs.unobserve(this._onRemoteBrainChange);
    this._yMeta.unobserve(this._onMetaChange);

    if (this._provider) {
      this._provider.destroy();
      this._provider = null;
    }

    this._prevNodeRefs.clear();
    this._prevEdgeRefs.clear();
    this._prevPeerNames.clear();
    this._pendingKicks.clear();

    this._ydoc.destroy();

    useCollabStore.getState()._setRoomId(null);
    useCollabStore.getState()._setConnected(false);
    useCollabStore.getState()._setInitializing(false);
    useCollabStore.getState()._setIsOwner(false);
    useCollabStore.getState()._setPeerCount(0);
    useAwarenessStore.getState()._setPeers([]);

    this._claimOwnershipOnSync = false;

    CollabDoc._instance = null;
  }

  // ── Ownership ─────────────────────────────────────────────────────────

  /** True iff the local client is recognized as the room owner. */
  get isOwner(): boolean {
    return useCollabStore.getState().isOwner;
  }

  private _claimOwnershipIfRequested(): void {
    if (!this._claimOwnershipOnSync || !this._roomId) return;
    this._claimOwnershipOnSync = false;

    const localToken = readLocalOwnerToken(this._roomId);
    if (!localToken) return;

    // Only claim if nobody else already owns the room — Y.js merge semantics
    // would otherwise let two "first movers" overwrite each other.
    if (!this._yMeta.has("ownerToken")) {
      this._ydoc.transact(() => {
        this._yMeta.set("ownerToken", localToken);
      });
    }
  }

  private _recomputeOwnerStatus(): void {
    if (!this._roomId) {
      useCollabStore.getState()._setIsOwner(false);
      return;
    }
    const remoteToken = this._yMeta.get("ownerToken");
    const localToken = readLocalOwnerToken(this._roomId);
    const isOwner = Boolean(remoteToken && localToken && remoteToken === localToken);
    if (useCollabStore.getState().isOwner !== isOwner) {
      useCollabStore.getState()._setIsOwner(isOwner);
    }
  }

  private _onMetaChange = (): void => {
    this._recomputeOwnerStatus();
  };

  /** Update the local user's ephemeral awareness state. */
  updateAwareness(patch: {
    selectedNodeId?: string | null;
    cursor?: CursorPosition | null;
  }): void {
    if (!this._provider) return;
    for (const [key, value] of Object.entries(patch)) {
      this._provider.setAwarenessField(key, value);
    }
  }

  /**
   * Update the local user's display name. Persists to sessionStorage and
   * rebroadcasts the `user` awareness field so peers see the new name.
   */
  setUserName(name: string): void {
    if (!this._provider) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    saveUserName(trimmed);
    const selfColors = getColorForClientId(this._ydoc.clientID);
    this._provider.setAwarenessField("user", {
      name: trimmed,
      color: selfColors.color,
      colorLight: selfColors.colorLight,
    });
    useAwarenessStore
      .getState()
      ._setSelf(this._ydoc.clientID, trimmed, selfColors.color, selfColors.colorLight);
  }

  /**
   * Ask a remote peer to leave by broadcasting a `kickRequest` via our own
   * awareness state. The targeted client self-destructs when it observes the
   * request, since we can't forcibly close their socket from here.
   */
  kick(clientId: number): void {
    if (!this._provider) return;
    const at = Date.now();
    this._pendingKicks.set(clientId, at);
    this._provider.setAwarenessField("kickRequest", { targetClientId: clientId, at });
  }

  get clientId(): number {
    return this._ydoc.clientID;
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
    const newIds = new Set<string>();
    for (const n of nodes) newIds.add(n.id);

    // Remove deleted nodes
    for (const id of this._yNodes.keys()) {
      if (!newIds.has(id)) this._yNodes.delete(id);
    }

    // Upsert — reference-equal nodes are skipped outright (fast path during
    // node drags where only the dragged node's ref changes).
    const nextRefs = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      const prev = this._prevNodeRefs.get(node.id);
      if (prev === node) {
        nextRefs.set(node.id, node);
        continue;
      }
      const cleaned = cleanNodeForSync(node);
      const existing = this._yNodes.get(node.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(cleaned)) {
        this._yNodes.set(node.id, cleaned);
      }
      nextRefs.set(node.id, node);
    }
    this._prevNodeRefs = nextRefs;
  }

  private _syncEdgesToYjs(edges: WorkflowEdge[]): void {
    const newIds = new Set<string>();
    for (const e of edges) newIds.add(e.id);

    for (const id of this._yEdges.keys()) {
      if (!newIds.has(id)) this._yEdges.delete(id);
    }

    const nextRefs = new Map<string, WorkflowEdge>();
    for (const edge of edges) {
      const prev = this._prevEdgeRefs.get(edge.id);
      if (prev === edge) {
        nextRefs.set(edge.id, edge);
        continue;
      }
      const cleaned = cleanEdgeForSync(edge);
      const existing = this._yEdges.get(edge.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(cleaned)) {
        this._yEdges.set(edge.id, cleaned);
      }
      nextRefs.set(edge.id, edge);
    }
    this._prevEdgeRefs = nextRefs;
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

    // Detect kick requests targeting self — any peer broadcasting
    // { kickRequest: { targetClientId: selfId } } causes us to disconnect.
    if (!this._isKicked) {
      for (const [clientId, state] of allStates) {
        if (clientId === selfId) continue;
        const req = state.kickRequest;
        if (req && req.targetClientId === selfId) {
          this._isKicked = true;
          toast.error("You were removed from this collaboration session");
          // Remove ?room= from URL so a reload doesn't rejoin.
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (url.searchParams.has("room")) {
              url.searchParams.delete("room");
              window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
            }
          }
          // Defer destroy so we don't tear down mid-observer.
          queueMicrotask(() => this.destroy());
          return;
        }
      }
    }

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
        cursor: state.cursor ?? null,
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

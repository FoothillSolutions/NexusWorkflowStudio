/**
 * SpacetimeDB Client Connection Manager
 *
 * Singleton wrapper around the SpacetimeDB DbConnection that handles:
 * - Identity token persistence in localStorage
 * - Automatic reconnection with exponential backoff
 * - Connection lifecycle (connect/disconnect/isConnected)
 * - Event callbacks for connection state changes
 */

"use client";

import { getSpacetimeUri, getSpacetimeDbName } from "./config";
import { DbConnection, type SubscriptionHandle } from "./module_bindings";

// ── Identity Token Persistence ─────────────────────────────────────────────

const IDENTITY_TOKEN_KEY_PREFIX = "nexus:spacetime-identity-";

function getIdentityTokenKey(): string {
  return `${IDENTITY_TOKEN_KEY_PREFIX}${getSpacetimeDbName()}`;
}

function loadIdentityToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(getIdentityTokenKey());
}

function saveIdentityToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getIdentityTokenKey(), token);
}

// ── Connection State ───────────────────────────────────────────────────────

export type SpacetimeConnectionState = "disconnected" | "connecting" | "connected";

type ConnectionStateListener = (state: SpacetimeConnectionState) => void;
type SubscriptionReadyListener = () => void;

// ── SpacetimeClient Singleton ──────────────────────────────────────────────

/**
 * Manages a single SpacetimeDB connection for the browser session.
 *
 * Uses the generated SpacetimeDB v2 bindings for reducer calls and table
 * subscriptions. Sync bridges own their table-specific listeners.
 */
class SpacetimeClient {
  private static _instance: SpacetimeClient | null = null;

  private _state: SpacetimeConnectionState = "disconnected";
  private _connection: DbConnection | null = null;
  private _identity: string | null = null;
  private _stateListeners = new Set<ConnectionStateListener>();
  private _subscriptionReadyListeners = new Set<SubscriptionReadyListener>();
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 10;
  private _intentionalDisconnect = false;

  private constructor() {}

  static getInstance(): SpacetimeClient {
    if (!SpacetimeClient._instance) {
      SpacetimeClient._instance = new SpacetimeClient();
    }
    return SpacetimeClient._instance;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  get state(): SpacetimeConnectionState {
    return this._state;
  }

  get identity(): string | null {
    return this._identity;
  }

  get isConnected(): boolean {
    return this._state === "connected";
  }

  get connection(): DbConnection | null {
    return this._connection;
  }

  onStateChange(listener: ConnectionStateListener): () => void {
    this._stateListeners.add(listener);
    return () => this._stateListeners.delete(listener);
  }

  onSubscriptionReady(listener: SubscriptionReadyListener): () => void {
    this._subscriptionReadyListeners.add(listener);
    return () => this._subscriptionReadyListeners.delete(listener);
  }

  connect(): void {
    if (this._state !== "disconnected") return;

    this._intentionalDisconnect = false;
    this._setState("connecting");

    const token = loadIdentityToken();

    let builder = DbConnection.builder()
      .withUri(getSpacetimeUri())
      .withDatabaseName(getSpacetimeDbName())
      .withCompression("gzip")
      .onConnect((_connection, identity, authToken) => {
        this._identity = identity.toHexString();
        saveIdentityToken(authToken);
        this._reconnectAttempts = 0;
        this._setState("connected");
      })
      .onDisconnect(() => {
        this._connection = null;
        this._setState("disconnected");

        if (!this._intentionalDisconnect) {
          this._scheduleReconnect();
        }
      })
      .onConnectError(() => {
        this._connection = null;
        this._setState("disconnected");

        if (!this._intentionalDisconnect) {
          this._scheduleReconnect();
        }
      });

    if (token) {
      builder = builder.withToken(token);
    }

    this._connection = builder.build();
  }

  disconnect(): void {
    this._intentionalDisconnect = true;
    this._clearReconnectTimer();

    if (this._connection) {
      this._connection.disconnect();
      this._connection = null;
    }

    this._setState("disconnected");
  }

  /**
   * Send a reducer call to SpacetimeDB using the generated v2 reducer API.
   */
  async callReducer(reducerName: string, args: unknown[]): Promise<void> {
    if (!this._connection || this._state !== "connected") {
      throw new Error(`Cannot call reducer '${reducerName}': not connected to SpacetimeDB`);
    }

    const reducers = this._connection.reducers;

    switch (reducerName) {
      case "add_brain_feedback":
        return reducers.addBrainFeedback({ docId: String(args[0]), type: String(args[1]), comment: String(args[2]) });
      case "apply_workflow_ops":
        return reducers.applyWorkflowOps({ workflowId: String(args[0]), opsJson: String(args[1]), displayName: String(args[2]) });
      case "create_invite":
        return reducers.createInvite({ workspaceId: String(args[0]), tokenHash: String(args[1]) });
      case "create_workflow":
        return reducers.createWorkflow({ id: String(args[0]), workspaceId: String(args[1]), name: String(args[2]), displayName: String(args[3]) });
      case "create_workspace":
        return reducers.createWorkspace({ id: String(args[0]), name: String(args[1]), displayName: String(args[2]) });
      case "delete_brain_doc":
        return reducers.deleteBrainDoc({ docId: String(args[0]) });
      case "delete_workflow":
        return reducers.deleteWorkflow({ workflowId: String(args[0]) });
      case "delete_workspace":
        return reducers.deleteWorkspace({ workspaceId: String(args[0]) });
      case "import_brain_doc":
        return reducers.importBrainDoc({ id: String(args[0]), workspaceId: String(args[1]), title: String(args[2]), contentJson: String(args[3]), createdAt: String(args[4]), updatedAt: String(args[5]) });
      case "import_workflow_snapshot":
        return reducers.importWorkflowSnapshot({ workflowId: String(args[0]), workspaceId: String(args[1]), name: String(args[2]), nodesJson: String(args[3]), edgesJson: String(args[4]), uiStateJson: String(args[5]), createdAt: String(args[6]), updatedAt: String(args[7]), lastModifiedBy: String(args[8]) });
      case "import_workspace":
        return reducers.importWorkspace({ id: String(args[0]), name: String(args[1]), createdAt: String(args[2]), updatedAt: String(args[3]), displayName: String(args[4]) });
      case "join_workspace":
        return reducers.joinWorkspace({ tokenHash: String(args[0]), displayName: String(args[1]) });
      case "record_brain_view":
        return reducers.recordBrainView({ docId: String(args[0]) });
      case "rename_workflow":
        return reducers.renameWorkflow({ workflowId: String(args[0]), newName: String(args[1]) });
      case "rename_workspace":
        return reducers.renameWorkspace({ workspaceId: String(args[0]), newName: String(args[1]) });
      case "restore_brain_doc_version":
        return reducers.restoreBrainDocVersion({ docId: String(args[0]), versionId: String(args[1]), snapshotVersionId: String(args[2]) });
      case "save_brain_doc":
        return reducers.saveBrainDoc({ id: String(args[0]), workspaceId: String(args[1]), title: String(args[2]), contentJson: String(args[3]), versionId: args[4] == null ? undefined : String(args[4]) });
      case "update_presence":
        return reducers.updatePresence({ workspaceId: String(args[0]), workflowId: String(args[1]), displayName: String(args[2]), selectedNodeId: args[3] == null ? undefined : String(args[3]) });
      case "update_workflow_ui_state":
        return reducers.updateWorkflowUiState({ workflowId: String(args[0]), uiStateJson: String(args[1]) });
      default:
        throw new Error(`Unknown SpacetimeDB reducer '${reducerName}'`);
    }
  }

  /**
   * Subscribe to SpacetimeDB table queries.
   * Tables are specified as SQL-like query strings.
   */
  subscribe(queries: string[], onApplied?: () => void): SubscriptionHandle {
    if (!this._connection || this._state !== "connected") {
      throw new Error("Cannot subscribe: not connected to SpacetimeDB");
    }

    return this._connection
      .subscriptionBuilder()
      .onApplied(() => {
        onApplied?.();
        for (const listener of this._subscriptionReadyListeners) {
          listener();
        }
      })
      .onError((ctx) => {
        console.error("SpacetimeDB subscription error", ctx.event);
      })
      .subscribe(queries);
  }

  // ── Private ────────────────────────────────────────────────────────────

  private _setState(newState: SpacetimeConnectionState): void {
    if (this._state === newState) return;
    this._state = newState;
    for (const listener of this._stateListeners) {
      listener(newState);
    }
  }

  private _scheduleReconnect(): void {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) return;

    this._clearReconnectTimer();

    // Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30_000);
    this._reconnectAttempts++;

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

export { SpacetimeClient };

/** Convenience accessor for the singleton. */
export function getSpacetimeClient(): SpacetimeClient {
  return SpacetimeClient.getInstance();
}

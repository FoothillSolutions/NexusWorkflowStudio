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
 * Since the SpacetimeDB SDK generates specific binding classes that depend on
 * the published module, this client uses a generic WebSocket approach that
 * wraps the generated DbConnection when available. For now it provides the
 * connection lifecycle and state management; actual table subscriptions are
 * set up by the sync bridges (workspace-sync.ts, brain-sync.ts, presence.ts).
 */
class SpacetimeClient {
  private static _instance: SpacetimeClient | null = null;

  private _state: SpacetimeConnectionState = "disconnected";
  private _connection: WebSocket | null = null;
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

  get connection(): WebSocket | null {
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

    const uri = getSpacetimeUri();
    const dbName = getSpacetimeDbName();
    const token = loadIdentityToken();

    // Build WebSocket URL with database name and optional token
    const wsUrl = new URL(`/database/subscribe/${dbName}`, uri.replace("ws://", "http://").replace("wss://", "https://"));
    if (token) {
      wsUrl.searchParams.set("token", token);
    }

    const ws = new WebSocket(wsUrl.toString().replace("http://", "ws://").replace("https://", "wss://"));

    ws.onopen = () => {
      this._reconnectAttempts = 0;
      this._setState("connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        // Handle identity token assignment
        if (msg.type === "identity_token" && msg.token) {
          this._identity = msg.identity ?? null;
          saveIdentityToken(msg.token);
        }

        // Handle subscription ready
        if (msg.type === "subscription_applied" || msg.type === "transaction_update") {
          for (const listener of this._subscriptionReadyListeners) {
            listener();
          }
        }
      } catch {
        // Non-JSON messages are ignored
      }
    };

    ws.onclose = () => {
      this._connection = null;
      this._setState("disconnected");

      if (!this._intentionalDisconnect) {
        this._scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // Error will trigger onclose, which handles reconnection
    };

    this._connection = ws;
  }

  disconnect(): void {
    this._intentionalDisconnect = true;
    this._clearReconnectTimer();

    if (this._connection) {
      this._connection.close();
      this._connection = null;
    }

    this._setState("disconnected");
  }

  /**
   * Send a reducer call to SpacetimeDB.
   * The message format follows the SpacetimeDB WebSocket protocol.
   */
  callReducer(reducerName: string, args: unknown[]): void {
    if (!this._connection || this._state !== "connected") {
      throw new Error(`Cannot call reducer '${reducerName}': not connected to SpacetimeDB`);
    }

    this._connection.send(
      JSON.stringify({
        type: "call_reducer",
        reducer: reducerName,
        args,
      }),
    );
  }

  /**
   * Subscribe to SpacetimeDB table queries.
   * Tables are specified as SQL-like query strings.
   */
  subscribe(queries: string[]): void {
    if (!this._connection || this._state !== "connected") {
      throw new Error("Cannot subscribe: not connected to SpacetimeDB");
    }

    this._connection.send(
      JSON.stringify({
        type: "subscribe",
        queries,
      }),
    );
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

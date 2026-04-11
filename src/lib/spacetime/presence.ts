/**
 * SpacetimeDB Presence Layer
 *
 * Manages user presence/awareness via SpacetimeDB presence rows.
 * Replaces Y.js awareness for workspace mode.
 *
 * - Subscribes to presence rows for the current workspace
 * - Throttles local selection updates (~500ms)
 * - Maps SpacetimeDB identities to display names via workspace_member rows
 * - Server-side cleanup on disconnect via __identity_disconnected__
 */

"use client";

import throttle from "lodash.throttle";
import { useAwarenessStore } from "@/store/collaboration/awareness-store";
import { useCollabStore } from "@/store/collaboration/collab-store";
import { getSpacetimeClient } from "./client";
import { getColorForClientId } from "@/lib/collaboration/awareness-names";
import type { SpacetimePresence } from "./types";

class SpacetimePresenceManager {
  private _workspaceId: string | null = null;
  private _workflowId: string | null = null;
  private _displayName = "Anonymous";
  private _active = false;
  private _messageHandler: ((event: MessageEvent) => void) | null = null;

  // Cache of remote presence rows
  private _remotePresence = new Map<string, SpacetimePresence>();

  // Throttled presence update
  private _updatePresenceThrottled = throttle(
    (selectedNodeId: string | null) => this._sendPresenceUpdate(selectedNodeId),
    500,
  );

  // ── Public API ─────────────────────────────────────────────────────────

  isActive(): boolean {
    return this._active;
  }

  startPresence(
    workspaceId: string,
    workflowId: string,
    displayName?: string,
  ): void {
    if (this._active) this.stopPresence();

    this._workspaceId = workspaceId;
    this._workflowId = workflowId;
    this._displayName = displayName ?? "Anonymous";
    this._active = true;

    const client = getSpacetimeClient();

    this._messageHandler = (event: MessageEvent) => {
      this._onMessage(event);
    };

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
  }

  stopPresence(): void {
    this._active = false;

    this._updatePresenceThrottled.cancel();

    if (this._messageHandler) {
      const ws = getSpacetimeClient().connection;
      if (ws) {
        ws.removeEventListener("message", this._messageHandler);
      }
      this._messageHandler = null;
    }

    this._remotePresence.clear();
    useAwarenessStore.getState()._setPeers([]);
    useCollabStore.getState()._setPeerCount(0);

    this._workspaceId = null;
    this._workflowId = null;
  }

  /** Update the local user's selected node (throttled). */
  updateSelection(selectedNodeId: string | null): void {
    if (!this._active) return;
    this._updatePresenceThrottled(selectedNodeId);
  }

  // ── Private: Subscription Setup ────────────────────────────────────────

  private _setupSubscriptions(): void {
    const client = getSpacetimeClient();
    const ws = client.connection;
    if (!ws || !this._messageHandler) return;

    ws.addEventListener("message", this._messageHandler);

    client.subscribe([
      `SELECT * FROM presence WHERE workspaceId = '${this._workspaceId}'`,
    ]);

    // Send initial presence
    this._sendPresenceUpdate(null);
  }

  // ── Private: Send presence update ──────────────────────────────────────

  private _sendPresenceUpdate(selectedNodeId: string | null): void {
    if (!this._active || !this._workspaceId || !this._workflowId) return;

    try {
      getSpacetimeClient().callReducer("update_presence", [
        this._workspaceId,
        this._workflowId,
        this._displayName,
        selectedNodeId,
      ]);
    } catch {
      // Ignore if not connected
    }
  }

  // ── Private: Handle incoming messages ──────────────────────────────────

  private _onMessage(event: MessageEvent): void {
    if (!this._active) return;

    try {
      const msg = JSON.parse(event.data as string);
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
    let presenceChanged = false;

    for (const update of tableUpdates) {
      if (update.table_name !== "presence") continue;

      for (const del of update.deletes ?? []) {
        const row = del as unknown as SpacetimePresence;
        this._remotePresence.delete(row.identity);
        presenceChanged = true;
      }

      for (const ins of update.inserts ?? []) {
        const row = ins as unknown as SpacetimePresence;
        if (row.workspaceId === this._workspaceId) {
          // Skip our own presence
          const selfIdentity = getSpacetimeClient().identity;
          if (row.identity === selfIdentity) continue;

          this._remotePresence.set(row.identity, row);
          presenceChanged = true;
        }
      }
    }

    if (presenceChanged) {
      this._updatePeerStore();
    }
  }

  private _updatePeerStore(): void {
    const peers = Array.from(this._remotePresence.values())
      .filter((p) => p.workflowId === this._workflowId)
      .map((p) => {
        // Use a stable hash of the identity string for color
        const colorSeed = hashCode(p.identity);
        const colors = getColorForClientId(colorSeed);

        return {
          clientId: colorSeed,
          user: {
            name: p.displayName,
            color: colors.color,
            colorLight: colors.colorLight,
          },
          selectedNodeId: p.selectedNodeId ?? null,
        };
      });

    useAwarenessStore.getState()._setPeers(peers);
    useCollabStore.getState()._setPeerCount(peers.length);
  }
}

/** Simple string hash for stable color generation. */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export const spacetimePresence = new SpacetimePresenceManager();

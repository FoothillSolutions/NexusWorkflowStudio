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
import type { SubscriptionHandle } from "./module_bindings";
import type { Presence as BindingPresence } from "./module_bindings/types";

class SpacetimePresenceManager {
  private _workspaceId: string | null = null;
  private _workflowId: string | null = null;
  private _displayName = "Anonymous";
  private _active = false;
  private _subscription: SubscriptionHandle | null = null;
  private _tableUnsubs: Array<() => void> = [];

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

    this._teardownSubscriptions();

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
    const connection = client.connection;
    if (!connection) return;

    this._teardownSubscriptions();

    const onInsert = (_ctx: unknown, row: BindingPresence) => this._upsertPresence(row);
    const onUpdate = (_ctx: unknown, _oldRow: BindingPresence, row: BindingPresence) => this._upsertPresence(row);
    const onDelete = (_ctx: unknown, row: BindingPresence) => this._deletePresence(row);

    connection.db.presence.onInsert(onInsert);
    connection.db.presence.onUpdate?.(onUpdate);
    connection.db.presence.onDelete(onDelete);
    this._tableUnsubs.push(
      () => connection.db.presence.removeOnInsert(onInsert),
      () => connection.db.presence.removeOnUpdate?.(onUpdate),
      () => connection.db.presence.removeOnDelete(onDelete),
    );

    this._subscription = client.subscribe(
      [`SELECT * FROM presence WHERE workspace_id = '${this._workspaceId}'`],
      () => this._syncFromCache(connection),
    );

    // Send initial presence
    this._sendPresenceUpdate(null);
  }

  // ── Private: Send presence update ──────────────────────────────────────

  private _sendPresenceUpdate(selectedNodeId: string | null): void {
    if (!this._active || !this._workspaceId || !this._workflowId) return;

    try {
      void getSpacetimeClient()
        .callReducer("update_presence", [
          this._workspaceId,
          this._workflowId,
          this._displayName,
          selectedNodeId,
        ])
        .catch(() => {
          // Ignore if not connected
        });
    } catch {
      // Ignore if not connected
    }
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

  private _syncFromCache(connection: NonNullable<ReturnType<typeof getSpacetimeClient>["connection"]>): void {
    if (!this._active) return;

    this._remotePresence.clear();
    for (const row of connection.db.presence.iter()) {
      this._upsertPresence(row);
    }
    this._updatePeerStore();
  }

  private _upsertPresence(row: BindingPresence): void {
    if (!this._active || row.workspaceId !== this._workspaceId) return;

    const identity = row.identity.toHexString();
    if (identity === getSpacetimeClient().identity) return;

    this._remotePresence.set(identity, {
      workspaceId: row.workspaceId,
      workflowId: row.workflowId,
      identity,
      displayName: row.displayName,
      selectedNodeId: row.selectedNodeId ?? null,
      lastSeenAt: row.lastSeenAt,
    });
    this._updatePeerStore();
  }

  private _deletePresence(row: BindingPresence): void {
    const identity = row.identity.toHexString();
    this._remotePresence.delete(identity);
    this._updatePeerStore();
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

/**
 * SpacetimeDB Brain Document Sync Bridge
 *
 * Subscribes to brain_doc, brain_doc_version, and brain_feedback rows for
 * the current workspace and syncs changes into the Brain Zustand store.
 * Replaces REST-based brain operations with SpacetimeDB reducer calls.
 */

"use client";

import { useKnowledgeStore } from "@/store/knowledge";
import { replaceAllKnowledgeDocs } from "@/lib/knowledge";
import { getSpacetimeClient } from "./client";
import type { KnowledgeDoc } from "@/types/knowledge";
import type { SpacetimeBrainDoc } from "./types";
import { spacetimeToBrainDoc, brainDocToContentJson } from "./types";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

// Module-level mutex — prevents feedback loops (mirrors collab-doc.ts)
let _isApplyingRemoteBrain = false;

class SpacetimeBrainSync {
  private _workspaceId: string | null = null;
  private _active = false;
  private _messageHandler: ((event: MessageEvent) => void) | null = null;
  private _storeUnsub: (() => void) | null = null;

  // Cache of current brain docs from SpacetimeDB
  private _remoteDocs = new Map<string, KnowledgeDoc>();

  // ── Public API ─────────────────────────────────────────────────────────

  isActive(): boolean {
    return this._active;
  }

  startBrainSync(workspaceId: string): void {
    if (this._active) this.stopBrainSync();

    this._workspaceId = workspaceId;
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

    // Watch knowledge store for local changes → SpacetimeDB
    this._storeUnsub = useKnowledgeStore.subscribe((_state) => {
      if (_isApplyingRemoteBrain) return;
      // Local changes are pushed via explicit save/delete calls,
      // not via the store subscriber (to avoid complexity with the
      // refresh() call pattern in the knowledge store).
    });
  }

  stopBrainSync(): void {
    this._active = false;

    this._storeUnsub?.();
    this._storeUnsub = null;

    if (this._messageHandler) {
      const ws = getSpacetimeClient().connection;
      if (ws) {
        ws.removeEventListener("message", this._messageHandler);
      }
      this._messageHandler = null;
    }

    this._remoteDocs.clear();
    this._workspaceId = null;
  }

  // ── SpacetimeDB-backed operations (replace REST calls) ─────────────────

  saveBrainDoc(doc: Partial<KnowledgeDoc> & { title: string }): void {
    if (!this._workspaceId) return;

    const id = doc.id ?? nanoid();
    const contentJson = brainDocToContentJson(doc as KnowledgeDoc);
    const versionId = doc.id ? nanoid() : null; // Create version only for updates

    getSpacetimeClient().callReducer("save_brain_doc", [
      id,
      this._workspaceId,
      doc.title,
      contentJson,
      versionId,
    ]);
  }

  deleteBrainDoc(docId: string): void {
    getSpacetimeClient().callReducer("delete_brain_doc", [docId]);
  }

  recordView(docId: string): void {
    getSpacetimeClient().callReducer("record_brain_view", [docId]);
  }

  addFeedback(docId: string, type: string, comment: string): void {
    getSpacetimeClient().callReducer("add_brain_feedback", [
      docId,
      type,
      comment,
    ]);
  }

  restoreVersion(docId: string, versionId: string): void {
    const snapshotVersionId = nanoid();
    getSpacetimeClient().callReducer("restore_brain_doc_version", [
      docId,
      versionId,
      snapshotVersionId,
    ]);
  }

  // ── Private: Subscription Setup ────────────────────────────────────────

  private _setupSubscriptions(): void {
    const client = getSpacetimeClient();
    const ws = client.connection;
    if (!ws || !this._messageHandler) return;

    ws.addEventListener("message", this._messageHandler);

    client.subscribe([
      `SELECT * FROM brain_doc WHERE workspaceId = '${this._workspaceId}'`,
      `SELECT * FROM brain_doc_version WHERE docId IN (SELECT id FROM brain_doc WHERE workspaceId = '${this._workspaceId}')`,
      `SELECT * FROM brain_feedback WHERE docId IN (SELECT id FROM brain_doc WHERE workspaceId = '${this._workspaceId}')`,
    ]);
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
    let docsChanged = false;

    for (const update of tableUpdates) {
      if (update.table_name === "brain_doc") {
        for (const del of update.deletes ?? []) {
          const row = del as unknown as SpacetimeBrainDoc;
          this._remoteDocs.delete(row.id);
          docsChanged = true;
        }
        for (const ins of update.inserts ?? []) {
          const row = ins as unknown as SpacetimeBrainDoc;
          if (row.workspaceId === this._workspaceId && !row.deletedAt) {
            this._remoteDocs.set(row.id, spacetimeToBrainDoc(row));
            docsChanged = true;
          } else if (row.deletedAt) {
            this._remoteDocs.delete(row.id);
            docsChanged = true;
          }
        }
      }
    }

    if (docsChanged) {
      this._applyRemoteBrainChange();
    }
  }

  private _applyRemoteBrainChange(): void {
    _isApplyingRemoteBrain = true;

    try {
      const docs = Array.from(this._remoteDocs.values());

      // Write-through to localStorage
      replaceAllKnowledgeDocs(docs);

      // Update Zustand state
      useKnowledgeStore.setState({ docs });

      queueMicrotask(() => {
        _isApplyingRemoteBrain = false;
      });
    } catch {
      _isApplyingRemoteBrain = false;
    }
  }
}

export const spacetimeBrainSync = new SpacetimeBrainSync();

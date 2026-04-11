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
import type { SubscriptionHandle } from "./module_bindings";
import type { BrainDoc as BindingBrainDoc } from "./module_bindings/types";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

// Module-level mutex — prevents feedback loops (mirrors collab-doc.ts)
let _isApplyingRemoteBrain = false;

class SpacetimeBrainSync {
  private _workspaceId: string | null = null;
  private _active = false;
  private _subscription: SubscriptionHandle | null = null;
  private _tableUnsubs: Array<() => void> = [];
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

    this._teardownSubscriptions();

    this._remoteDocs.clear();
    this._workspaceId = null;
  }

  // ── SpacetimeDB-backed operations (replace REST calls) ─────────────────

  saveBrainDoc(doc: Partial<KnowledgeDoc> & { title: string }): void {
    if (!this._workspaceId) return;

    const id = doc.id ?? nanoid();
    const contentJson = brainDocToContentJson(doc as KnowledgeDoc);
    const versionId = doc.id ? nanoid() : undefined; // Create version only for updates

    void getSpacetimeClient()
      .callReducer("save_brain_doc", [
        id,
        this._workspaceId,
        doc.title,
        contentJson,
        versionId,
      ])
      .catch(() => {});
  }

  deleteBrainDoc(docId: string): void {
    void getSpacetimeClient().callReducer("delete_brain_doc", [docId]).catch(() => {});
  }

  recordView(docId: string): void {
    void getSpacetimeClient().callReducer("record_brain_view", [docId]).catch(() => {});
  }

  addFeedback(docId: string, type: string, comment: string): void {
    void getSpacetimeClient()
      .callReducer("add_brain_feedback", [
        docId,
        type,
        comment,
      ])
      .catch(() => {});
  }

  restoreVersion(docId: string, versionId: string): void {
    const snapshotVersionId = nanoid();
    void getSpacetimeClient()
      .callReducer("restore_brain_doc_version", [
        docId,
        versionId,
        snapshotVersionId,
      ])
      .catch(() => {});
  }

  // ── Private: Subscription Setup ────────────────────────────────────────

  private _setupSubscriptions(): void {
    const client = getSpacetimeClient();
    const connection = client.connection;
    if (!connection) return;

    this._teardownSubscriptions();

    const onDocInsert = (_ctx: unknown, row: BindingBrainDoc) => this._upsertRemoteDoc(row);
    const onDocUpdate = (_ctx: unknown, _oldRow: BindingBrainDoc, row: BindingBrainDoc) => this._upsertRemoteDoc(row);
    const onDocDelete = (_ctx: unknown, row: BindingBrainDoc) => this._deleteRemoteDoc(row);

    connection.db.brainDoc.onInsert(onDocInsert);
    connection.db.brainDoc.onUpdate?.(onDocUpdate);
    connection.db.brainDoc.onDelete(onDocDelete);
    this._tableUnsubs.push(
      () => connection.db.brainDoc.removeOnInsert(onDocInsert),
      () => connection.db.brainDoc.removeOnUpdate?.(onDocUpdate),
      () => connection.db.brainDoc.removeOnDelete(onDocDelete),
    );

    this._subscription = client.subscribe(
      [
        `SELECT * FROM brain_doc WHERE workspace_id = '${this._workspaceId}'`,
        `SELECT * FROM brain_doc_version WHERE doc_id IN (SELECT id FROM brain_doc WHERE workspace_id = '${this._workspaceId}')`,
        `SELECT * FROM brain_feedback WHERE doc_id IN (SELECT id FROM brain_doc WHERE workspace_id = '${this._workspaceId}')`,
      ],
      () => this._syncFromCache(connection),
    );
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

    this._remoteDocs.clear();
    for (const row of connection.db.brainDoc.iter()) {
      if (row.workspaceId === this._workspaceId && !row.deletedAt) {
        this._remoteDocs.set(row.id, spacetimeToBrainDoc(row as SpacetimeBrainDoc));
      }
    }
    this._applyRemoteBrainChange();
  }

  private _upsertRemoteDoc(row: BindingBrainDoc): void {
    if (!this._active || row.workspaceId !== this._workspaceId) return;

    if (row.deletedAt) {
      this._remoteDocs.delete(row.id);
    } else {
      this._remoteDocs.set(row.id, spacetimeToBrainDoc(row as SpacetimeBrainDoc));
    }
    this._applyRemoteBrainChange();
  }

  private _deleteRemoteDoc(row: BindingBrainDoc): void {
    if (!this._active || row.workspaceId !== this._workspaceId) return;

    this._remoteDocs.delete(row.id);
    this._applyRemoteBrainChange();
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

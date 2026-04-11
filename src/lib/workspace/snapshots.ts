import { getStorageProvider } from "@/lib/storage";
import { getWorkspace } from "./server";
import type { SnapshotMeta, SnapshotFile, ChangeEvent, WorkflowChanges, ChangesResponse } from "./types";
import type { WorkflowJSON } from "@/types/workflow";

function storage() {
  return getStorageProvider();
}

function snapshotsPrefix(workspaceId: string, workflowId: string): string {
  return `workspaces/${workspaceId}/snapshots/${workflowId}`;
}

function toUrlSafeTimestamp(iso: string): string {
  return iso.replace(/:/g, "-");
}

function fromUrlSafeTimestamp(safe: string): string {
  const tIndex = safe.indexOf("T");
  if (tIndex < 0) return safe;
  const datePart = safe.slice(0, tIndex);
  const timePart = safe.slice(tIndex).replace(/-/g, ":");
  return datePart + timePart;
}

export async function writeSnapshot(
  workspaceId: string,
  workflowId: string,
  data: WorkflowJSON,
  savedBy: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const snapshot: SnapshotFile = { timestamp, workflowId, workspaceId, savedBy, data };
  const filename = `${toUrlSafeTimestamp(timestamp)}.json`;
  const key = `${snapshotsPrefix(workspaceId, workflowId)}/${filename}`;

  await storage().writeAtomic(key, JSON.stringify(snapshot, null, 2));
}

export async function listSnapshots(
  workspaceId: string,
  workflowId: string,
): Promise<SnapshotMeta[]> {
  const prefix = snapshotsPrefix(workspaceId, workflowId);
  const entries = await storage().list(prefix);

  const metas: SnapshotMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json") || entry.endsWith(".tmp")) continue;
    const safeName = entry.replace(".json", "");
    const timestamp = fromUrlSafeTimestamp(safeName);
    try {
      const raw = await storage().read(`${prefix}/${entry}`);
      if (!raw) continue;
      const snap = JSON.parse(raw) as SnapshotFile;
      metas.push({ timestamp, savedBy: snap.savedBy });
    } catch {
      // skip corrupt files
    }
  }

  metas.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return metas;
}

export async function getSnapshot(
  workspaceId: string,
  workflowId: string,
  timestamp: string,
): Promise<SnapshotFile | null> {
  const filename = `${toUrlSafeTimestamp(timestamp)}.json`;
  const key = `${snapshotsPrefix(workspaceId, workflowId)}/${filename}`;
  try {
    const raw = await storage().read(key);
    if (!raw) return null;
    return JSON.parse(raw) as SnapshotFile;
  } catch {
    return null;
  }
}

interface NodeInfo {
  id: string;
  label: string;
}

function extractNodes(data: WorkflowJSON): Map<string, NodeInfo> {
  const map = new Map<string, NodeInfo>();
  for (const node of data.nodes) {
    map.set(node.id, {
      id: node.id,
      label: (node.data as Record<string, unknown>)?.label as string ?? node.id,
    });
  }
  return map;
}

function diffNodeSets(
  older: Map<string, NodeInfo>,
  newer: Map<string, NodeInfo>,
  savedBy: string,
  timestamp: string,
): ChangeEvent[] {
  const events: ChangeEvent[] = [];

  for (const [id, info] of newer) {
    if (!older.has(id)) {
      events.push({ type: "node_added", nodeName: info.label, by: savedBy, at: timestamp });
    }
  }

  for (const [id, info] of older) {
    if (!newer.has(id)) {
      events.push({ type: "node_deleted", nodeName: info.label, by: savedBy, at: timestamp });
    }
  }

  for (const [id, newInfo] of newer) {
    const oldInfo = older.get(id);
    if (oldInfo && oldInfo.label !== newInfo.label) {
      events.push({
        type: "node_renamed",
        nodeName: newInfo.label,
        from: oldInfo.label,
        to: newInfo.label,
        by: savedBy,
        at: timestamp,
      });
    }
  }

  return events;
}

export async function computeChanges(
  workspaceId: string,
  since: string,
): Promise<ChangesResponse> {
  const manifest = await getWorkspace(workspaceId);
  if (!manifest) return { changes: [] };

  const results: WorkflowChanges[] = [];

  for (const wfRecord of manifest.workflows) {
    const allMetas = await listSnapshots(workspaceId, wfRecord.id);
    if (allMetas.length === 0) continue;

    const afterSince = allMetas.filter((m) => m.timestamp > since);
    if (afterSince.length === 0) continue;

    const beforeSince = allMetas.filter((m) => m.timestamp <= since);
    const baselineMeta = beforeSince.length > 0 ? beforeSince[beforeSince.length - 1] : null;

    const snapshotsToWalk: SnapshotFile[] = [];

    if (baselineMeta) {
      const baseSnap = await getSnapshot(workspaceId, wfRecord.id, baselineMeta.timestamp);
      if (baseSnap) snapshotsToWalk.push(baseSnap);
    }

    for (const meta of afterSince) {
      const snap = await getSnapshot(workspaceId, wfRecord.id, meta.timestamp);
      if (snap) snapshotsToWalk.push(snap);
    }

    if (snapshotsToWalk.length === 0) continue;

    const events: ChangeEvent[] = [];

    if (!baselineMeta && snapshotsToWalk.length > 0) {
      const first = snapshotsToWalk[0];
      const emptyMap = new Map<string, NodeInfo>();
      const firstNodes = extractNodes(first.data);
      events.push(...diffNodeSets(emptyMap, firstNodes, first.savedBy, first.timestamp));

      for (let i = 1; i < snapshotsToWalk.length; i++) {
        const older = extractNodes(snapshotsToWalk[i - 1].data);
        const newer = extractNodes(snapshotsToWalk[i].data);
        events.push(...diffNodeSets(older, newer, snapshotsToWalk[i].savedBy, snapshotsToWalk[i].timestamp));
      }
    } else {
      for (let i = 1; i < snapshotsToWalk.length; i++) {
        const older = extractNodes(snapshotsToWalk[i - 1].data);
        const newer = extractNodes(snapshotsToWalk[i].data);
        events.push(...diffNodeSets(older, newer, snapshotsToWalk[i].savedBy, snapshotsToWalk[i].timestamp));
      }
    }

    if (events.length > 0) {
      results.push({
        workflowId: wfRecord.id,
        workflowName: wfRecord.name,
        changeCount: events.length,
        events,
      });
    }
  }

  return { changes: results };
}

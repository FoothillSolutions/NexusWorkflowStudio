import { customAlphabet } from "nanoid";
import { writeSnapshot } from "./snapshots";
import { getStorageProvider } from "@/lib/storage";
import type { WorkspaceManifest, WorkspaceRecord, WorkflowRecord } from "./types";
import type { WorkflowJSON } from "@/types/workflow";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 21);
const MANIFEST_FILE = "manifest.json";

function nowIso(): string {
  return new Date().toISOString();
}

function storage() {
  return getStorageProvider();
}

function validateId(id: string): void {
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw new Error("Invalid workspace id");
  }
}

function manifestKey(id: string): string {
  validateId(id);
  return `workspaces/${id}/${MANIFEST_FILE}`;
}

function workflowKey(workspaceId: string, workflowId: string): string {
  validateId(workspaceId);
  validateId(workflowId);
  return `workspaces/${workspaceId}/workflows/${workflowId}.json`;
}

async function readJsonKey<T>(key: string, fallback: T): Promise<T> {
  const raw = await storage().read(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonKey(key: string, value: unknown): Promise<void> {
  await storage().write(key, JSON.stringify(value, null, 2));
}

function createDefaultWorkflowJSON(name: string): WorkflowJSON {
  return {
    name,
    nodes: [],
    edges: [],
    ui: {
      sidebarOpen: true,
      minimapVisible: false,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  try {
    const dirs = await storage().listDirectories("workspaces");
    const workspaces: WorkspaceRecord[] = [];
    for (const dir of dirs) {
      const key = `workspaces/${dir}/${MANIFEST_FILE}`;
      const manifest = await readJsonKey<WorkspaceManifest | null>(key, null);
      if (manifest?.workspace) {
        workspaces.push(manifest.workspace);
      }
    }
    workspaces.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return workspaces;
  } catch {
    return [];
  }
}

export async function createWorkspace(name: string): Promise<WorkspaceRecord> {
  const id = nanoid();
  const now = nowIso();
  const workspace: WorkspaceRecord = { id, name, createdAt: now, updatedAt: now };
  const manifest: WorkspaceManifest = { version: 1, workspace, workflows: [] };

  await writeJsonKey(manifestKey(id), manifest);

  return workspace;
}

export async function getWorkspace(id: string): Promise<WorkspaceManifest | null> {
  const key = manifestKey(id);
  if (!(await storage().exists(key))) return null;
  return readJsonKey<WorkspaceManifest | null>(key, null);
}

export async function updateWorkspace(
  id: string,
  updates: { name: string },
): Promise<WorkspaceRecord | null> {
  const manifest = await getWorkspace(id);
  if (!manifest) return null;

  manifest.workspace.name = updates.name;
  manifest.workspace.updatedAt = nowIso();
  await writeJsonKey(manifestKey(id), manifest);

  return manifest.workspace;
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const manifest = await getWorkspace(id);
  if (!manifest) return false;

  validateId(id);
  await storage().deleteTree(`workspaces/${id}`);
  return true;
}

export async function createWorkflow(
  workspaceId: string,
  name: string,
): Promise<WorkflowRecord | null> {
  const manifest = await getWorkspace(workspaceId);
  if (!manifest) return null;

  const id = nanoid();
  const now = nowIso();
  const record: WorkflowRecord = {
    id,
    workspaceId,
    name,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: "",
  };

  manifest.workflows.push(record);
  manifest.workspace.updatedAt = now;
  await writeJsonKey(workflowKey(workspaceId, id), createDefaultWorkflowJSON(name));
  await writeJsonKey(manifestKey(workspaceId), manifest);

  return record;
}

export async function getWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<WorkflowJSON | null> {
  const key = workflowKey(workspaceId, workflowId);
  if (!(await storage().exists(key))) return null;
  return readJsonKey<WorkflowJSON | null>(key, null);
}

export async function saveWorkflow(
  workspaceId: string,
  workflowId: string,
  data: WorkflowJSON,
  lastModifiedBy: string,
): Promise<boolean> {
  const manifest = await getWorkspace(workspaceId);
  if (!manifest) return false;

  const record = manifest.workflows.find((w) => w.id === workflowId);
  if (!record) return false;

  const now = nowIso();
  record.updatedAt = now;
  record.lastModifiedBy = lastModifiedBy;
  manifest.workspace.updatedAt = now;

  await writeJsonKey(workflowKey(workspaceId, workflowId), data);
  await writeJsonKey(manifestKey(workspaceId), manifest);
  await writeSnapshot(workspaceId, workflowId, data, lastModifiedBy);

  return true;
}

export async function updateWorkflowMeta(
  workspaceId: string,
  workflowId: string,
  updates: { name: string },
): Promise<WorkflowRecord | null> {
  const manifest = await getWorkspace(workspaceId);
  if (!manifest) return null;

  const record = manifest.workflows.find((w) => w.id === workflowId);
  if (!record) return null;

  record.name = updates.name;
  record.updatedAt = nowIso();
  manifest.workspace.updatedAt = record.updatedAt;
  await writeJsonKey(manifestKey(workspaceId), manifest);

  return record;
}

export async function deleteWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<boolean> {
  const manifest = await getWorkspace(workspaceId);
  if (!manifest) return false;

  const index = manifest.workflows.findIndex((w) => w.id === workflowId);
  if (index < 0) return false;

  manifest.workflows.splice(index, 1);
  manifest.workspace.updatedAt = nowIso();

  await storage().delete(workflowKey(workspaceId, workflowId));

  await writeJsonKey(manifestKey(workspaceId), manifest);
  return true;
}

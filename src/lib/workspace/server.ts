import fs from "node:fs/promises";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { getWorkspaceConfig } from "./config";
import { writeSnapshot } from "./snapshots";
import type { WorkspaceManifest, WorkspaceRecord, WorkflowRecord } from "./types";
import type { WorkflowJSON } from "@/types/workflow";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 21);
const MANIFEST_FILE = "manifest.json";

function nowIso(): string {
  return new Date().toISOString();
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function workspaceDir(id: string): string {
  return path.join(getWorkspaceConfig().dataDir, id);
}

function manifestPath(id: string): string {
  return path.join(workspaceDir(id), MANIFEST_FILE);
}

function workflowsDir(workspaceId: string): string {
  return path.join(workspaceDir(workspaceId), "workflows");
}

function workflowPath(workspaceId: string, workflowId: string): string {
  return path.join(workflowsDir(workspaceId), `${workflowId}.json`);
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
  const dataDir = getWorkspaceConfig().dataDir;
  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    const workspaces: WorkspaceRecord[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const mPath = path.join(dataDir, entry.name, MANIFEST_FILE);
      const manifest = await readJsonFile<WorkspaceManifest | null>(mPath, null);
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

  await ensureDir(workflowsDir(id));
  await writeJsonFile(manifestPath(id), manifest);

  return workspace;
}

export async function getWorkspace(id: string): Promise<WorkspaceManifest | null> {
  try {
    await fs.access(manifestPath(id));
  } catch {
    return null;
  }
  return readJsonFile<WorkspaceManifest | null>(manifestPath(id), null);
}

export async function updateWorkspace(
  id: string,
  updates: { name: string },
): Promise<WorkspaceRecord | null> {
  const manifest = await getWorkspace(id);
  if (!manifest) return null;

  manifest.workspace.name = updates.name;
  manifest.workspace.updatedAt = nowIso();
  await writeJsonFile(manifestPath(id), manifest);

  return manifest.workspace;
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
  await writeJsonFile(workflowPath(workspaceId, id), createDefaultWorkflowJSON(name));
  await writeJsonFile(manifestPath(workspaceId), manifest);

  return record;
}

export async function getWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<WorkflowJSON | null> {
  try {
    await fs.access(workflowPath(workspaceId, workflowId));
  } catch {
    return null;
  }
  return readJsonFile<WorkflowJSON | null>(workflowPath(workspaceId, workflowId), null);
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

  await writeJsonFile(workflowPath(workspaceId, workflowId), data);
  await writeJsonFile(manifestPath(workspaceId), manifest);
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
  await writeJsonFile(manifestPath(workspaceId), manifest);

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

  try {
    await fs.unlink(workflowPath(workspaceId, workflowId));
  } catch {
    // file may already be gone
  }

  await writeJsonFile(manifestPath(workspaceId), manifest);
  return true;
}

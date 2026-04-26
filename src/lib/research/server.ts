import fs from "node:fs/promises";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { getWorkspaceConfig } from "@/lib/workspace/config";
import { getWorkspace } from "@/lib/workspace/server";
import { createTemplateBlocks } from "./templates";
import type { ResearchManifest, ResearchSpaceData, ResearchSpaceRecord, ResearchTemplateId } from "./types";

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

function researchDir(workspaceId: string): string {
  return path.join(getWorkspaceConfig().dataDir, workspaceId, "research");
}

function manifestPath(workspaceId: string): string {
  return path.join(researchDir(workspaceId), MANIFEST_FILE);
}

function spacesDir(workspaceId: string): string {
  return path.join(researchDir(workspaceId), "spaces");
}

function spacePath(workspaceId: string, spaceId: string): string {
  return path.join(spacesDir(workspaceId), `${spaceId}.json`);
}

function emptyManifest(workspaceId: string): ResearchManifest {
  return { version: 1, workspaceId, spaces: [], updatedAt: nowIso() };
}

async function ensureWorkspace(workspaceId: string): Promise<boolean> {
  return Boolean(await getWorkspace(workspaceId));
}

async function readManifest(workspaceId: string): Promise<ResearchManifest | null> {
  if (!(await ensureWorkspace(workspaceId))) return null;
  await ensureDir(spacesDir(workspaceId));
  const manifest = await readJsonFile<ResearchManifest | null>(manifestPath(workspaceId), null);
  if (manifest) return manifest;
  const created = emptyManifest(workspaceId);
  await writeJsonFile(manifestPath(workspaceId), created);
  return created;
}

function toRecord(data: ResearchSpaceData): ResearchSpaceRecord {
  return {
    id: data.id,
    workspaceId: data.workspaceId,
    name: data.name,
    templateId: data.templateId,
    blockCount: data.blocks.length,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy,
    lastModifiedBy: data.lastModifiedBy,
    associatedWorkflowIds: data.associatedWorkflowIds,
  };
}

function sanitizeSpace(data: ResearchSpaceData): ResearchSpaceData {
  return {
    ...data,
    blocks: data.blocks.map((block) => {
      const { ...safe } = block;
      return safe;
    }),
    collapsedIds: data.blocks.filter((block) => block.collapsed).map((block) => block.id),
  };
}

export async function listResearchSpaces(workspaceId: string): Promise<ResearchSpaceRecord[] | null> {
  const manifest = await readManifest(workspaceId);
  return manifest?.spaces ?? null;
}

export async function createResearchSpace(
  workspaceId: string,
  input: { name: string; templateId?: ResearchTemplateId | null; createdBy?: string },
): Promise<ResearchSpaceData | null> {
  const manifest = await readManifest(workspaceId);
  if (!manifest) return null;

  const now = nowIso();
  const id = nanoid();
  const data: ResearchSpaceData = {
    id,
    workspaceId,
    name: input.name,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy ?? "",
    lastModifiedBy: input.createdBy ?? "",
    blocks: input.templateId ? createTemplateBlocks(input.templateId, input.createdBy ?? "template") : [],
    collapsedIds: [],
    ghostNotes: [],
    syntheses: [],
    templateId: input.templateId ?? null,
    associatedWorkflowIds: [],
    viewMode: "tiling",
    selectedBlockIds: [],
  };
  const saved = sanitizeSpace(data);
  manifest.spaces.unshift(toRecord(saved));
  manifest.updatedAt = now;
  await writeJsonFile(spacePath(workspaceId, id), saved);
  await writeJsonFile(manifestPath(workspaceId), manifest);
  return saved;
}

export async function getResearchSpace(workspaceId: string, spaceId: string): Promise<ResearchSpaceData | null> {
  const manifest = await readManifest(workspaceId);
  if (!manifest?.spaces.some((space) => space.id === spaceId)) return null;
  return readJsonFile<ResearchSpaceData | null>(spacePath(workspaceId, spaceId), null);
}

export async function saveResearchSpace(
  workspaceId: string,
  spaceId: string,
  data: ResearchSpaceData,
  lastModifiedBy: string,
): Promise<ResearchSpaceData | null> {
  const manifest = await readManifest(workspaceId);
  if (!manifest) return null;
  const index = manifest.spaces.findIndex((space) => space.id === spaceId);
  if (index < 0) return null;
  const now = nowIso();
  const saved = sanitizeSpace({ ...data, id: spaceId, workspaceId, updatedAt: now, lastModifiedBy });
  manifest.spaces[index] = toRecord(saved);
  manifest.updatedAt = now;
  await writeJsonFile(spacePath(workspaceId, spaceId), saved);
  await writeJsonFile(manifestPath(workspaceId), manifest);
  return saved;
}

export async function updateResearchSpaceMeta(
  workspaceId: string,
  spaceId: string,
  updates: { name?: string; templateId?: ResearchTemplateId | null; associatedWorkflowIds?: string[] },
): Promise<ResearchSpaceRecord | null> {
  const data = await getResearchSpace(workspaceId, spaceId);
  if (!data) return null;
  const saved = await saveResearchSpace(
    workspaceId,
    spaceId,
    { ...data, ...updates },
    data.lastModifiedBy || "metadata",
  );
  return saved ? toRecord(saved) : null;
}

export async function deleteResearchSpace(workspaceId: string, spaceId: string): Promise<boolean> {
  const manifest = await readManifest(workspaceId);
  if (!manifest) return false;
  const index = manifest.spaces.findIndex((space) => space.id === spaceId);
  if (index < 0) return false;
  manifest.spaces.splice(index, 1);
  manifest.updatedAt = nowIso();
  try {
    await fs.unlink(spacePath(workspaceId, spaceId));
  } catch {
    // Already gone.
  }
  await writeJsonFile(manifestPath(workspaceId), manifest);
  return true;
}

export function getResearchStoragePaths(workspaceId: string, spaceId?: string) {
  return {
    manifest: manifestPath(workspaceId),
    spacesDir: spacesDir(workspaceId),
    space: spaceId ? spacePath(workspaceId, spaceId) : null,
  };
}

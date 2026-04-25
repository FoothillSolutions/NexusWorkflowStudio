"use client";

import type {
  LibraryScope,
  SkillRef,
  SkillBundle,
  ValidationWarning,
} from "@/types/library";
import type {
  PackRecord,
  SkillRecord,
  LibraryDocumentRecord,
  LibraryDocumentVersionRecord,
  PackVersionRecord,
  SkillVersionRecord,
  MergeRecord,
  ConflictRecord,
  LibraryRecord,
  DocumentRole,
} from "@/lib/library-store/types";

const BRAIN_TOKEN_KEY = "nexus:brain-token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRAIN_TOKEN_KEY);
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json");
  }
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  const json = await response.json().catch(() => null) as { error?: string } & T | null;
  if (!response.ok) {
    throw new Error(json?.error ?? `Request failed: ${response.status}`);
  }
  return json as T;
}

export interface LibrarySession {
  workspaceId: string;
  ownerUserId: string | null;
  libraries: LibraryRecord[];
}

export async function libraryBootstrap(ownerUserId: string | null = null): Promise<LibrarySession> {
  return request<LibrarySession>("/api/library/session", {
    method: "POST",
    body: JSON.stringify({ token: getStoredToken(), ownerUserId }),
  });
}

export async function listPacksForScope(scope: LibraryScope): Promise<PackRecord[]> {
  const { packs } = await request<{ packs: PackRecord[] }>(`/api/library/packs?scope=${scope}`);
  return packs;
}

export async function createPack(scope: LibraryScope, packKey: string, name: string, description?: string): Promise<PackRecord> {
  const { pack } = await request<{ pack: PackRecord }>("/api/library/packs", {
    method: "POST",
    body: JSON.stringify({ scope, packKey, name, description }),
  });
  return pack;
}

export async function getPack(packId: string): Promise<PackRecord | null> {
  const { pack } = await request<{ pack: PackRecord | null }>(`/api/library/packs/${packId}`);
  return pack;
}

export async function updatePack(packId: string, patch: { name?: string; description?: string; tags?: string[] }): Promise<PackRecord> {
  const { pack } = await request<{ pack: PackRecord }>(`/api/library/packs/${packId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return pack;
}

export async function softDeletePack(packId: string): Promise<void> {
  await request<{ deleted: true }>(`/api/library/packs/${packId}`, { method: "DELETE" });
}

export async function forkPack(packId: string, targetScope: LibraryScope = "user"): Promise<PackRecord> {
  const { pack } = await request<{ pack: PackRecord }>(`/api/library/packs/${packId}/fork`, {
    method: "POST",
    body: JSON.stringify({ targetScope }),
  });
  return pack;
}

export async function listDocuments(packId: string): Promise<LibraryDocumentRecord[]> {
  const { documents } = await request<{ documents: LibraryDocumentRecord[] }>(`/api/library/packs/${packId}/documents`);
  return documents;
}

export async function createDocument(packId: string, payload: { role: DocumentRole; path: string; content: string }): Promise<{ document: LibraryDocumentRecord; version: LibraryDocumentVersionRecord }> {
  return request(`/api/library/packs/${packId}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDocument(packId: string, docId: string, patch: { path?: string; role?: DocumentRole }): Promise<LibraryDocumentRecord> {
  const { document } = await request<{ document: LibraryDocumentRecord }>(`/api/library/packs/${packId}/documents/${docId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return document;
}

export async function deleteDocument(packId: string, docId: string): Promise<void> {
  await request<{ deleted: true }>(`/api/library/packs/${packId}/documents/${docId}`, { method: "DELETE" });
}

export async function listDocumentVersions(packId: string, docId: string): Promise<LibraryDocumentVersionRecord[]> {
  const { versions } = await request<{ versions: LibraryDocumentVersionRecord[] }>(`/api/library/packs/${packId}/documents/${docId}/versions`);
  return versions;
}

export async function saveDocumentVersion(packId: string, docId: string, payload: { content: string; previousVersionId: string | null; message?: string }): Promise<LibraryDocumentVersionRecord> {
  const { version } = await request<{ version: LibraryDocumentVersionRecord }>(`/api/library/packs/${packId}/documents/${docId}/versions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return version;
}

export async function getDocumentVersionContent(packId: string, docId: string, versionId: string): Promise<string> {
  const { content } = await request<{ content: string }>(`/api/library/packs/${packId}/documents/${docId}/versions/${versionId}/content`);
  return content;
}

export async function listSkills(packId: string): Promise<SkillRecord[]> {
  const { skills } = await request<{ skills: SkillRecord[] }>(`/api/library/packs/${packId}/skills`);
  return skills;
}

export async function createSkill(packId: string, payload: { skillKey: string; name: string; description: string; entrypointDocId: string }): Promise<SkillRecord> {
  const { skill } = await request<{ skill: SkillRecord }>(`/api/library/packs/${packId}/skills`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return skill;
}

export async function updateSkill(packId: string, skillId: string, patch: { name?: string; description?: string; deprecated?: boolean }): Promise<SkillRecord> {
  const { skill } = await request<{ skill: SkillRecord }>(`/api/library/packs/${packId}/skills/${skillId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return skill;
}

export async function deleteSkill(packId: string, skillId: string): Promise<void> {
  await request<{ deleted: true }>(`/api/library/packs/${packId}/skills/${skillId}`, { method: "DELETE" });
}

export async function publishPackVersion(packId: string, payload: { version: string; notes?: string }): Promise<PackVersionRecord> {
  const { packVersion } = await request<{ packVersion: PackVersionRecord }>(`/api/library/packs/${packId}/versions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return packVersion;
}

export async function listPackVersions(packId: string): Promise<PackVersionRecord[]> {
  const { versions } = await request<{ versions: PackVersionRecord[] }>(`/api/library/packs/${packId}/versions`);
  return versions;
}

export async function publishSkillVersion(packId: string, skillId: string, payload: { version: string; notes?: string; linkToLatestPackVersion?: boolean }): Promise<SkillVersionRecord> {
  const { skillVersion } = await request<{ skillVersion: SkillVersionRecord }>(`/api/library/packs/${packId}/skills/${skillId}/versions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return skillVersion;
}

export async function listSkillVersions(packId: string, skillId: string): Promise<SkillVersionRecord[]> {
  const { versions } = await request<{ versions: SkillVersionRecord[] }>(`/api/library/packs/${packId}/skills/${skillId}/versions`);
  return versions;
}

export async function mergeBaseIntoBranch(packId: string): Promise<MergeRecord> {
  const { merge } = await request<{ merge: MergeRecord }>(`/api/library/packs/${packId}/merge-base`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return merge;
}

export async function listMergeConflicts(packId: string, mergeId: string): Promise<ConflictRecord[]> {
  const { conflicts } = await request<{ conflicts: ConflictRecord[] }>(`/api/library/packs/${packId}/merges/${mergeId}/resolve`);
  return conflicts;
}

export async function resolveMergeConflict(packId: string, mergeId: string, payload: { resolvedContentByDocId: Record<string, string>; resolvedBy?: string }): Promise<MergeRecord> {
  const { merge } = await request<{ merge: MergeRecord }>(`/api/library/packs/${packId}/merges/${mergeId}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return merge;
}

export async function resolveLiveSkill(ref: SkillRef): Promise<SkillBundle | null> {
  const { bundle } = await request<{ bundle: SkillBundle | null }>("/api/library/resolve", {
    method: "POST",
    body: JSON.stringify(ref),
  });
  return bundle;
}

export async function validatePack(packId: string): Promise<ValidationWarning[]> {
  const { warnings } = await request<{ warnings: ValidationWarning[] }>(`/api/library/packs/${packId}?validate=1`);
  return warnings;
}

export async function exportNexusArchive(workflowJson: unknown, workflowName: string): Promise<Blob> {
  const token = getStoredToken();
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch("/api/library/export", {
    method: "POST",
    headers,
    body: JSON.stringify({ workflowJson, workflowName }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? `Export failed: ${response.status}`);
  }
  return response.blob();
}

export async function importNexusArchive(file: File, scope: LibraryScope = "workspace"): Promise<PackRecord[]> {
  const token = getStoredToken();
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scope", scope);
  formData.append("format", "nexus");
  const response = await fetch("/api/library/import", {
    method: "POST",
    headers,
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? `Import failed: ${response.status}`);
  }
  const { packs } = await response.json() as { packs: PackRecord[] };
  return packs;
}

"use client";

import { customAlphabet } from "nanoid";
import { getAllKnowledgeDocs, replaceAllKnowledgeDocs } from "@/lib/knowledge";
import type { SaveBrainDocInput } from "@/lib/brain/types";
import type {
  BrainSession,
  KnowledgeBrain,
  KnowledgeDoc,
  KnowledgeDocVersion,
  KnowledgeFeedback,
} from "@/types/knowledge";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const BRAIN_TOKEN_KEY = "nexus:brain-token";
const BRAIN_MIGRATED_KEY = "nexus:brain-migrated";
const BRAIN_SHARE_PARAM = "brain";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRAIN_TOKEN_KEY);
}

function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BRAIN_TOKEN_KEY, token);
}

function getUrlToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(BRAIN_SHARE_PARAM);
}

function clearUrlToken(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(BRAIN_SHARE_PARAM)) return;
  url.searchParams.delete(BRAIN_SHARE_PARAM);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function getMigrationFlag(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(BRAIN_MIGRATED_KEY) === "1";
}

function markMigrated(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BRAIN_MIGRATED_KEY, "1");
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(input, { ...init, headers });
  const json = await response.json().catch(() => null) as { error?: string } & T | null;
  if (!response.ok) {
    throw new Error(json?.error ?? `Request failed: ${response.status}`);
  }
  return json as T;
}

function createMigrationPayload(): KnowledgeBrain | null {
  if (getMigrationFlag()) return null;
  const docs = getAllKnowledgeDocs();
  if (docs.length === 0) {
    markMigrated();
    return null;
  }
  return {
    version: "1",
    exportedAt: new Date().toISOString(),
    docs,
  };
}

export async function ensureBrainSession(): Promise<BrainSession> {
  const token = getStoredToken() ?? getUrlToken();
  const legacyBrain = token ? null : createMigrationPayload();

  const session = await request<BrainSession>("/api/brain/session", {
    method: "POST",
    body: JSON.stringify({ token, legacyBrain }),
  });

  setStoredToken(session.token);
  clearUrlToken();
  replaceAllKnowledgeDocs(session.docs);
  markMigrated();
  return session;
}

export async function fetchBrainDocs(): Promise<KnowledgeDoc[]> {
  await ensureBrainSession();
  const { docs } = await request<{ docs: KnowledgeDoc[] }>("/api/brain/documents");
  replaceAllKnowledgeDocs(docs);
  return docs;
}

export async function saveBrainDoc(
  partial: SaveBrainDocInput,
): Promise<KnowledgeDoc> {
  await ensureBrainSession();
  const { doc } = await request<{ doc: KnowledgeDoc }>("/api/brain/documents", {
    method: "POST",
    body: JSON.stringify(partial),
  });
  return doc;
}

export async function deleteBrainDoc(id: string): Promise<void> {
  await ensureBrainSession();
  await request<{ deleted: true }>(`/api/brain/documents/${id}`, {
    method: "DELETE",
  });
}

export async function recordBrainDocView(id: string): Promise<KnowledgeDoc> {
  await ensureBrainSession();
  const { doc } = await request<{ doc: KnowledgeDoc }>(`/api/brain/documents/${id}/view`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return doc;
}

export async function addBrainDocFeedback(
  id: string,
  feedback: Omit<KnowledgeFeedback, "id" | "at"> & Partial<Pick<KnowledgeFeedback, "id" | "at">>,
): Promise<KnowledgeDoc> {
  await ensureBrainSession();
  const completeFeedback: KnowledgeFeedback = {
    id: feedback.id ?? nanoid(),
    at: feedback.at ?? new Date().toISOString(),
    rating: feedback.rating,
    note: feedback.note,
    author: feedback.author,
  };
  const { doc } = await request<{ doc: KnowledgeDoc }>(`/api/brain/documents/${id}/feedback`, {
    method: "POST",
    body: JSON.stringify({ feedback: completeFeedback }),
  });
  return doc;
}

export async function fetchBrainDocVersions(id: string): Promise<KnowledgeDocVersion[]> {
  await ensureBrainSession();
  const { versions } = await request<{ versions: KnowledgeDocVersion[] }>(
    `/api/brain/documents/${id}/versions`,
  );
  return versions;
}

export async function restoreBrainDocVersion(
  docId: string,
  versionId: string,
): Promise<KnowledgeDoc> {
  await ensureBrainSession();
  const { doc } = await request<{ doc: KnowledgeDoc }>(`/api/brain/documents/${docId}/restore`, {
    method: "POST",
    body: JSON.stringify({ versionId }),
  });
  return doc;
}

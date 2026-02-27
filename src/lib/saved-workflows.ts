import type { WorkflowJSON } from "@/types/workflow";
import { workflowJsonSchema } from "@/lib/schemas";

// ── Storage key prefix ──────────────────────────────────────────────────────
const COLLECTION_KEY = "nexus-workflow-studio:saved-workflows";

// ── Types ───────────────────────────────────────────────────────────────────
export interface SavedWorkflowMeta {
  /** Unique identifier (nanoid) */
  id: string;
  /** Display name of the workflow */
  name: string;
  /** ISO timestamp of when the workflow was saved */
  savedAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Number of nodes in the workflow */
  nodeCount: number;
  /** Number of edges in the workflow */
  edgeCount: number;
}

export interface SavedWorkflowEntry extends SavedWorkflowMeta {
  /** The full workflow data */
  workflow: WorkflowJSON;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readCollection(): SavedWorkflowEntry[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedWorkflowEntry[];
  } catch {
    console.error("Failed to read saved workflows collection");
    return [];
  }
}

function writeCollection(entries: SavedWorkflowEntry[]): void {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(entries));
  } catch {
    console.error("Failed to write saved workflows collection");
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Get all saved workflow metadata (without full data for perf). */
export function listSavedWorkflows(): SavedWorkflowMeta[] {
  return readCollection().map(({ workflow: _, ...meta }) => meta);
}

/** Get all saved workflow entries (including full data). */
export function getAllSavedWorkflows(): SavedWorkflowEntry[] {
  return readCollection();
}

/** Save a workflow to the collection. If an entry with the same id exists, update it. */
export function saveWorkflowToCollection(
  id: string,
  workflow: WorkflowJSON
): SavedWorkflowEntry {
  const now = new Date().toISOString();
  const entries = readCollection();
  const existingIdx = entries.findIndex((e) => e.id === id);

  const entry: SavedWorkflowEntry = {
    id,
    name: workflow.name,
    savedAt: existingIdx >= 0 ? entries[existingIdx].savedAt : now,
    updatedAt: now,
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    workflow,
  };

  if (existingIdx >= 0) {
    entries[existingIdx] = entry;
  } else {
    entries.unshift(entry); // newest first
  }

  writeCollection(entries);
  return entry;
}

/** Delete a workflow from the collection by id. */
export function deleteFromCollection(id: string): void {
  const entries = readCollection().filter((e) => e.id !== id);
  writeCollection(entries);
}

/** Load a specific workflow from the collection by id. Returns null if not found. */
export function loadFromCollection(id: string): WorkflowJSON | null {
  const entry = readCollection().find((e) => e.id === id);
  if (!entry) return null;

  const result = workflowJsonSchema.safeParse(entry.workflow);
  if (!result.success) {
    console.warn("Saved workflow failed validation:", result.error);
    return null;
  }
  return result.data as unknown as WorkflowJSON;
}

/** Rename a saved workflow in the collection. */
export function renameInCollection(id: string, newName: string): void {
  const entries = readCollection();
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    entry.name = newName;
    entry.updatedAt = new Date().toISOString();
    writeCollection(entries);
  }
}

/** Duplicate a saved workflow in the collection with a new id. */
export function duplicateInCollection(
  sourceId: string,
  newId: string
): SavedWorkflowEntry | null {
  const entries = readCollection();
  const source = entries.find((e) => e.id === sourceId);
  if (!source) return null;

  const now = new Date().toISOString();
  const duplicate: SavedWorkflowEntry = {
    ...source,
    id: newId,
    name: `${source.name} (Copy)`,
    savedAt: now,
    updatedAt: now,
    workflow: { ...source.workflow, name: `${source.name} (Copy)` },
  };

  entries.unshift(duplicate);
  writeCollection(entries);
  return duplicate;
}


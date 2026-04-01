import type { WorkflowJSON, WorkflowNodeData, NodeType } from "@/types/workflow";
import { readJsonStorage, writeJsonStorage } from "@/lib/browser-storage";
import { readWorkflowJson } from "@/lib/workflow-validation";

// Storage key prefix
const COLLECTION_KEY = "nexus-workflow-studio:saved-workflows";
const LIBRARY_KEY = "nexus-workflow-studio:library";

// Library categories
export type LibraryCategory = "workflow" | "agent" | "skill" | "document" | "prompt" | "script";

export const LIBRARY_CATEGORIES: { value: LibraryCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "workflow", label: "Workflows" },
  { value: "prompt", label: "Prompts" },
  { value: "script", label: "Scripts" },
  { value: "agent", label: "Agents" },
  { value: "skill", label: "Skills" },
  { value: "document", label: "Documents" },
];

/** Maps node types to their library category */
export function nodeTypeToCategory(type: NodeType): LibraryCategory | null {
  switch (type) {
    case "agent": return "agent";
    case "skill": return "skill";
    case "document": return "document";
    case "prompt": return "prompt";
    case "script": return "script";
    default: return null;
  }
}

// Types
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

// Library item (individual node saved to library)
export interface LibraryItemEntry {
  id: string;
  name: string;
  category: LibraryCategory;
  nodeType: NodeType;
  savedAt: string;
  updatedAt: string;
  /** The full node data payload */
  nodeData: WorkflowNodeData;
  /** Optional short description extracted from node data */
  description?: string;
}

function normalizeNodeData(nodeData: WorkflowNodeData): WorkflowNodeData {
  if (nodeData.type !== "skill") return nodeData;

  const { projectName: _projectName, ...skillData } = nodeData as WorkflowNodeData & { projectName?: string };
  return skillData as WorkflowNodeData;
}

function normalizeLibraryItem(entry: LibraryItemEntry): LibraryItemEntry {
  return {
    ...entry,
    nodeData: normalizeNodeData(entry.nodeData),
  };
}

function isSupportedLibraryItem(entry: LibraryItemEntry): boolean {
  return nodeTypeToCategory(entry.nodeType) === entry.category;
}

// Helpers

function readCollection(): SavedWorkflowEntry[] {
  return readJsonStorage<SavedWorkflowEntry[]>(COLLECTION_KEY, [], () => {
    console.error("Failed to read saved workflows collection");
  });
}

function writeCollection(entries: SavedWorkflowEntry[]): void {
  writeJsonStorage(COLLECTION_KEY, entries, () => {
    console.error("Failed to write saved workflows collection");
  });
}

// Public API

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

  return readWorkflowJson(entry.workflow, (message) => {
    console.warn("Saved workflow failed validation:", message);
  });
}

/** Rename a saved workflow in the collection. */
export function renameInCollection(id: string, newName: string): void {
  const entries = readCollection();
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    entry.name = newName;
    entry.workflow.name = newName;
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

// Library items (individual reusable nodes saved from the canvas)

function readLibrary(): LibraryItemEntry[] {
  return readJsonStorage<LibraryItemEntry[]>(LIBRARY_KEY, [], () => {
    console.error("Failed to read library collection");
  });
}

function writeLibrary(entries: LibraryItemEntry[]): void {
  writeJsonStorage(LIBRARY_KEY, entries, () => {
    console.error("Failed to write library collection");
  });
}

/** Get all library items. */
export function getAllLibraryItems(): LibraryItemEntry[] {
  const entries = readLibrary();
  const supportedEntries = entries.filter(isSupportedLibraryItem).map(normalizeLibraryItem);

  if (supportedEntries.length !== entries.length) {
    writeLibrary(supportedEntries);
  }

  return supportedEntries;
}

/** Extract a short description from node data. */
function extractDescription(data: WorkflowNodeData): string {
  switch (data.type) {
    case "agent":
      return (data as import("@/types/workflow").SubAgentNodeData).description || "";
    case "skill":
      return (data as import("@/types/workflow").SkillNodeData).description || "";
    case "document":
      return (data as import("@/types/workflow").DocumentNodeData).description || "";
    case "prompt":
      return (data as import("@/types/workflow").PromptNodeData).promptText?.slice(0, 80) || "";
    case "script":
      return (data as import("@/types/workflow").ScriptNodeData).promptText?.slice(0, 80) || "";
    default:
      return "";
  }
}

/** Save a node to the library. */
export function saveNodeToLibrary(
  id: string,
  data: WorkflowNodeData
): LibraryItemEntry {
  const now = new Date().toISOString();
  const category = nodeTypeToCategory(data.type);
  if (!category) throw new Error(`Cannot save node type "${data.type}" to library`);

  const entries = readLibrary();
  const existingIdx = entries.findIndex((e) => e.id === id);

  const entry: LibraryItemEntry = {
    id,
    name: data.label || data.name || data.type,
    category,
    nodeType: data.type,
    savedAt: existingIdx >= 0 ? entries[existingIdx].savedAt : now,
    updatedAt: now,
    nodeData: normalizeNodeData({ ...data } as WorkflowNodeData),
    description: extractDescription(data),
  };

  if (existingIdx >= 0) {
    entries[existingIdx] = entry;
  } else {
    entries.unshift(entry);
  }

  writeLibrary(entries);
  return entry;
}

/** Delete a library item by id. */
export function deleteLibraryItem(id: string): void {
  const entries = readLibrary().filter((e) => e.id !== id);
  writeLibrary(entries);
}

/** Rename a library item. */
export function renameLibraryItem(id: string, newName: string): void {
  const entries = readLibrary();
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    entry.name = newName;
    entry.updatedAt = new Date().toISOString();
    writeLibrary(entries);
  }
}

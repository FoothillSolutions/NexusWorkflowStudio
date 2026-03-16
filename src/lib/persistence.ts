import throttle from "lodash.throttle";
import type { WorkflowJSON, WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { workflowJsonSchema } from "@/lib/workflow-schema";

const STORAGE_KEY = "nexus-workflow-studio:last";

// ── Strip transient React Flow properties from serialized JSON ───────────
// These properties are runtime-only (measured, selected, dragging) or
// always re-applied on load (edge type/style/animated, node deletable).

function cleanNode(node: WorkflowNode): WorkflowNode {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { measured, selected, dragging, deletable, ...rest } = node;

  // Recursively strip sub-workflow embedded nodes/edges
  if (rest.data?.type === "sub-workflow" && rest.data.subNodes) {
    return {
      ...rest,
      data: {
        ...rest.data,
        subNodes: (rest.data.subNodes as WorkflowNode[]).map(cleanNode),
        subEdges: (rest.data.subEdges as WorkflowEdge[]).map(cleanEdge),
      },
    } as WorkflowNode;
  }

  return rest as WorkflowNode;
}

function cleanNodeForFingerprint(node: WorkflowNode): WorkflowNode {
  const cleaned = cleanNode(node);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { position, ...rest } = cleaned;

  if (rest.data?.type === "sub-workflow" && rest.data.subNodes) {
    return {
      ...rest,
      data: {
        ...rest.data,
        subNodes: (rest.data.subNodes as WorkflowNode[]).map(cleanNodeForFingerprint),
        subEdges: (rest.data.subEdges as WorkflowEdge[]).map(cleanEdge),
      },
    } as WorkflowNode;
  }

  return rest as WorkflowNode;
}

function cleanEdge(edge: WorkflowEdge): WorkflowEdge {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { type, style, animated, selected, ...rest } = edge;
  return rest as WorkflowEdge;
}

/** Remove transient / redundant React Flow properties before persisting. */
export function stripTransientProperties(data: WorkflowJSON): WorkflowJSON {
  return {
    ...data,
    nodes: data.nodes.map(cleanNode),
    edges: data.edges.map(cleanEdge),
  };
}

/**
 * Normalize workflow data for save-status checks.
 * Unlike persisted JSON, this intentionally ignores node positions so moving
 * nodes around does not mark the workflow as unsaved.
 */
export function stripFingerprintProperties(data: WorkflowJSON): WorkflowJSON {
  return {
    ...data,
    nodes: data.nodes.map(cleanNodeForFingerprint),
    edges: data.edges.map(cleanEdge),
  };
}

// ── Save ────────────────────────────────────────────────────────────────────
export function saveToLocalStorage(data: WorkflowJSON): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    console.error("Failed to save workflow to localStorage");
  }
}

// ── Load ────────────────────────────────────────────────────────────────────
export function loadFromLocalStorage(): WorkflowJSON | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = workflowJsonSchema.safeParse(parsed);
    if (!result.success) {
      console.warn("Stored workflow failed validation:", result.error);
      return null;
    }
    return result.data as unknown as WorkflowJSON;
  } catch {
    console.error("Failed to load workflow from localStorage");
    return null;
  }
}

// ── Check if saved data exists ──────────────────────────────────────────────
export function hasSavedWorkflow(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

// ── Export (download) ───────────────────────────────────────────────────────
export function serializeName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
}

export function getWorkflowExportContent(data: WorkflowJSON): string {
  return JSON.stringify(data, null, 2);
}

export function getWorkflowExportFileName(data: Pick<WorkflowJSON, "name">): string {
  return `${serializeName(data.name)}.json`;
}

export function exportWorkflow(data: WorkflowJSON): void {
  const blob = new Blob([getWorkflowExportContent(data)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getWorkflowExportFileName(data);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Import (parse + validate file) ──────────────────────────────────────────
export async function importWorkflow(file: File): Promise<WorkflowJSON> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const result = workflowJsonSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid workflow file: ${result.error.message}`);
  }
  return result.data as unknown as WorkflowJSON;
}

// ── Throttled save (2 second interval) ──────────────────────────────────────
export const throttledSave = throttle(saveToLocalStorage, 2000, {
  leading: false,
  trailing: true,
});

// ── Custom project directories ──────────────────────────────────────────────

const CUSTOM_DIRS_KEY = "nexus:custom-project-dirs";
const ACTIVE_DIR_KEY = "nexus:active-project-dir";

export function loadCustomProjectDirs(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_DIRS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveCustomProjectDirs(dirs: string[]): void {
  try {
    localStorage.setItem(CUSTOM_DIRS_KEY, JSON.stringify(dirs));
  } catch {
    console.error("Failed to save custom project dirs");
  }
}

export function addCustomProjectDir(dir: string): string[] {
  const dirs = loadCustomProjectDirs();
  const normalized = dir.replace(/[\\/]+$/, "");
  if (!dirs.includes(normalized)) {
    dirs.push(normalized);
    saveCustomProjectDirs(dirs);
  }
  return dirs;
}

export function removeCustomProjectDir(dir: string): string[] {
  const dirs = loadCustomProjectDirs().filter((d) => d !== dir);
  saveCustomProjectDirs(dirs);
  return dirs;
}

export function getActiveProjectDir(): string | null {
  try {
    return localStorage.getItem(ACTIVE_DIR_KEY);
  } catch {
    return null;
  }
}

export function setActiveProjectDir(dir: string | null): void {
  try {
    if (dir) {
      localStorage.setItem(ACTIVE_DIR_KEY, dir);
    } else {
      localStorage.removeItem(ACTIVE_DIR_KEY);
    }
  } catch {
    console.error("Failed to save active project dir");
  }
}


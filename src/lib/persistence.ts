import throttle from "lodash.throttle";
import type { WorkflowJSON } from "@/types/workflow";
import { workflowJsonSchema } from "@/lib/schemas";

const STORAGE_KEY = "nexus-workflow-studio:last";

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
export function exportWorkflow(data: WorkflowJSON): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json`;
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

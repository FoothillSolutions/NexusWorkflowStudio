const STORAGE_KEY = "nexus:recent-workspaces";
const MAX_ENTRIES = 10;

export interface RecentWorkspaceEntry {
  id: string;
  name: string;
  workflowCount: number;
  memberNames: string[];
  lastAccessedAt: string;
}

export function getRecentWorkspaces(): RecentWorkspaceEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as RecentWorkspaceEntry[];
    return entries
      .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function addRecentWorkspace(entry: RecentWorkspaceEntry): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentWorkspaces();
    const filtered = existing.filter((e) => e.id !== entry.id);
    const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable
  }
}

export function removeRecentWorkspace(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentWorkspaces();
    const updated = existing.filter((entry) => entry.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable
  }
}

// ─── Project Context ─────────────────────────────────────────────────────────
// Fetches the project folder's file tree to provide context for AI generation.

import { useOpenCodeStore } from "../opencode-store";
import type { StoreGet, StoreSet } from "./types";

/** Recursively fetch a project file tree and format it as an indented string. */
async function fetchFileTree(
  client: { files: { list: (path: string) => Promise<Array<{ name: string; path: string; type: "file" | "directory"; ignored: boolean }>> } },
  rootPath: string,
  maxDepth: number = 3,
  maxFiles: number = 200,
): Promise<string> {
  let fileCount = 0;
  const IGNORED_DIRS = new Set([
    "node_modules", ".git", ".next", "dist", "build", "__pycache__",
    ".venv", "venv", ".tox", ".mypy_cache", ".pytest_cache",
    "target", ".idea", ".vscode", ".DS_Store", "coverage",
  ]);

  async function walk(path: string, depth: number, prefix: string): Promise<string[]> {
    if (depth > maxDepth || fileCount >= maxFiles) return [];
    try {
      const entries = await client.files.list(path);
      const lines: string[] = [];
      // Sort: directories first, then files
      const sorted = [...entries].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "directory" ? -1 : 1;
      });
      for (const entry of sorted) {
        if (fileCount >= maxFiles) {
          lines.push(`${prefix}… (truncated — ${maxFiles} file limit)`);
          break;
        }
        if (entry.ignored || IGNORED_DIRS.has(entry.name)) continue;
        if (entry.type === "directory") {
          lines.push(`${prefix}${entry.name}/`);
          const children = await walk(entry.path, depth + 1, prefix + "  ");
          lines.push(...children);
        } else {
          lines.push(`${prefix}${entry.name}`);
          fileCount++;
        }
      }
      return lines;
    } catch {
      return [`${prefix}(unable to read)`];
    }
  }

  const lines = await walk(rootPath, 0, "  ");
  return lines.join("\n");
}

/** Fetch the project folder context for the generation prompt. */
export async function fetchProjectContext(set: StoreSet, get: StoreGet): Promise<void> {
  const { projectContextStatus } = get();
  if (projectContextStatus === "loading") return;

  const client = useOpenCodeStore.getState().client;
  const project = useOpenCodeStore.getState().currentProject;
  if (!client) {
    set({ projectContext: null, projectContextStatus: "error" });
    return;
  }

  set({ projectContextStatus: "loading", projectContext: null });

  try {
    const rootPath = project?.worktree ?? ".";
    const tree = await fetchFileTree(client, rootPath);
    const projectName = project?.name ?? project?.worktree?.split(/[/\\]/).pop() ?? "project";
    const contextStr = `Project: ${projectName}\nRoot: ${project?.worktree ?? "(default)"}\n\n${tree}`;
    set({ projectContext: contextStr, projectContextStatus: "done" });
  } catch {
    set({ projectContext: null, projectContextStatus: "error" });
  }
}


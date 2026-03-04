// ── Changelog ────────────────────────────────────────────────────────────────
// Declare new versions here (newest first). The "What's New" dialog
// automatically shows once per version based on localStorage tracking.

export type ChangeCategory = "New" | "Improved" | "Fixed" | "Removed" | "Breaking";

export interface ChangelogEntry {
  /** Semver version string, e.g. "1.2.0" */
  version: string;
  /** Human-readable date, e.g. "March 4, 2026" */
  date: string;
  /** Grouped changes */
  categories: {
    category: ChangeCategory;
    items: string[];
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Add new entries at the TOP of this array.
// The first entry is always treated as the current version.
// ─────────────────────────────────────────────────────────────────────────────
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "March 4, 2026",
    categories: [
      {
        category: "New",
        items: [
          "Visual workflow editor with drag-and-drop node palette",
          "Sub-agent nodes with skill & document connections",
          "Sub-workflow nodes for nested workflow composition",
          "If/Else and Switch conditional branching nodes",
          "MCP Tool nodes for external tool integration",
          "Prompt & Document nodes with Markdown editing",
          "Workflow library with save, load & export",
          "Keyboard shortcuts for all major actions",
          "Auto-layout for automatic graph arrangement",
          "Dark theme optimised for long editing sessions",
        ],
      }
    ],
  },
];

/** The current app version — derived from the newest changelog entry. */
export const CURRENT_VERSION = CHANGELOG[0].version;


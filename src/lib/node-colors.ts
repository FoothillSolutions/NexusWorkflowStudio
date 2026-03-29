// Node accent colors
// Single source of truth for every node type's accent hex.
// Import from here instead of using literal color strings.

/** Accent hex per node type — used for handles, badges, inline styles, etc. */
export const NODE_ACCENT = {
  start:          "#10b981",  // emerald
  end:            "#ef4444",  // red
  prompt:         "#3b82f6",  // blue
  script:         "#38bdf8",  // sky
  agent:          "#5f27cd",  // violet
  "parallel-agent": "#6366f1",  // indigo
  "sub-workflow":  "#a855f7",  // purple
  skill:          "#06b6d4",  // cyan
  document:       "#eab308",  // yellow
  "mcp-tool":     "#14b8a6",  // teal
  "if-else":      "#f59e0b",  // amber
  switch:         "#f97316",  // orange
  "ask-user":     "#ec4899",  // pink
} as const;

export type NodeAccentKey = keyof typeof NODE_ACCENT;

// Semantic branch colors (not node accents)
export const BRANCH_TRUE  = "#22c55e";  // green — if-else true branch
export const BRANCH_FALSE = "#ef4444";  // red   — if-else false branch
export const BRANCH_DEFAULT = "#71717a"; // zinc  — switch default branch

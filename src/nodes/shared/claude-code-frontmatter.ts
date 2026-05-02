/**
 * Helpers for generating Claude Code-compatible sub-agent frontmatter.
 *
 * Claude Code agent files only accept a fixed set of
 * frontmatter fields, documented at
 * https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields.
 *
 * These helpers translate the app's generic/OpenCode-flavored data
 * (model ids, lowercase tool names, hex colors) into the shapes Claude
 * Code actually understands, returning `null` when a value can't be
 * mapped so the caller can omit the line entirely.
 */

/**
 * Claude Code's frontmatter expects the short names `sonnet`, `opus`,
 * `haiku`, or `inherit` — not the provider-prefixed ids
 * (e.g. `github-copilot/claude-sonnet-4.6`) used elsewhere in the app.
 */
export function mapModelForClaudeCode(model: string): string | null {
  const lower = model.toLowerCase();
  if (lower.includes("haiku")) return "haiku";
  if (lower.includes("opus")) return "opus";
  if (lower.includes("sonnet")) return "sonnet";
  return null;
}

/**
 * Map the app's lowercase tool ids (from `AGENT_TOOLS`) to Claude Code's
 * canonical tool names. Returns null for tools that don't have a direct
 * Claude Code equivalent so callers can drop them from the list.
 */
const CLAUDE_CODE_TOOL_NAMES: Record<string, string> = {
  bash: "Bash",
  edit: "Edit",
  write: "Write",
  read: "Read",
  grep: "Grep",
  glob: "Glob",
  webfetch: "WebFetch",
  websearch: "WebSearch",
  todowrite: "TodoWrite",
  question: "AskUserQuestion",
};

export function mapToolForClaudeCode(tool: string): string | null {
  return CLAUDE_CODE_TOOL_NAMES[tool.toLowerCase()] ?? null;
}

/**
 * Claude Code's `color` field only accepts a fixed palette of names.
 * Map the app's hex preset colors to the closest named equivalent.
 * Returns null for unknown hex values so the caller can omit the field.
 */
const HEX_TO_CLAUDE_COLOR: Record<string, string> = {
  // agent presets (src/nodes/agent/constants.ts PRESET_COLORS)
  "#5f27cd": "purple",
  "#ff6b6b": "red",
  "#ff9f43": "orange",
  "#feca57": "yellow",
  "#1dd1a1": "green",
  "#48dbfb": "cyan",
  "#54a0ff": "blue",
  "#ff6b81": "pink",
  "#a29bfe": "purple",
  "#fd79a8": "pink",
  // sub-workflow accent
  "#a855f7": "purple",
};

const CLAUDE_COLOR_NAMES = new Set([
  "red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan",
]);

export function mapColorForClaudeCode(color: string | undefined): string | null {
  if (!color) return null;
  const normalized = color.trim().toLowerCase();
  if (CLAUDE_COLOR_NAMES.has(normalized)) return normalized;
  return HEX_TO_CLAUDE_COLOR[normalized] ?? null;
}

/** Claude Code accepts these memory scopes; `-` / other values are dropped. */
const CLAUDE_CODE_MEMORY_SCOPES = new Set(["user", "project", "local"]);

export function mapMemoryForClaudeCode(memory: string | undefined): string | null {
  if (!memory) return null;
  return CLAUDE_CODE_MEMORY_SCOPES.has(memory) ? memory : null;
}

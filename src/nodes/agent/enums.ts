/** Model identifier — either the special "inherit" sentinel or a "providerID/modelID" string. */
export type SubAgentModel = string;

/** Named constants for well-known model values */
export const SubAgentModel = {
  Inherit: "inherit" as SubAgentModel,
} as const;

/**
 * Static display-name fallback map.
 * When connected to OpenCode, names come from the API; this is used offline or for the inherit option.
 */
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  inherit: "Inherit from workflow",
};

/**
 * Static cost-multiplier map (premium-request weighting).
 * The API doesn't return these, so we keep them as constants.
 * Unknown models default to 1.0x in the UI.
 */
export const MODEL_COST_MULTIPLIER: Record<string, number> = {
  // Anthropic Claude
  "github-copilot/claude-haiku-4.5":       0.33,
  "github-copilot/claude-opus-4.5":        3.0,
  "github-copilot/claude-opus-4.6":        3.0,
  "github-copilot/claude-opus-41":         3.0,
  "github-copilot/claude-sonnet-4":        1.0,
  "github-copilot/claude-sonnet-4.5":      1.0,
  "github-copilot/claude-sonnet-4.6":      1.0,
  // Google Gemini
  "github-copilot/gemini-2.5-pro":         1.0,
  "github-copilot/gemini-3-flash-preview": 0.33,
  "github-copilot/gemini-3-pro-preview":   1.0,
  "github-copilot/gemini-3.1-pro-preview": 1.0,
  // OpenAI
  "github-copilot/gpt-4.1":               0.5,
  "github-copilot/gpt-4o":                0.5,
  "github-copilot/gpt-5":                 2.0,
  "github-copilot/gpt-5-mini":            0.33,
  "github-copilot/gpt-5.1":               1.0,
  "github-copilot/gpt-5.1-codex":         1.0,
  "github-copilot/gpt-5.1-codex-max":     2.0,
  "github-copilot/gpt-5.1-codex-mini":    0.33,
  "github-copilot/gpt-5.2":               1.0,
  "github-copilot/gpt-5.2-codex":         1.0,
  // xAI
  "github-copilot/grok-code-fast-1":      0.33,
  // OpenCode Zen
  "opencode/trinity-large-preview-free":   0.5,
  "opencode/big-pickle":                   1.0,
  "opencode/minimax-m2.5-free":            0.5,
  "opencode/gpt-5-nano":                   0.33,
};

export enum SubAgentMemory {
  Default = "-",
  Local   = "local",
  User    = "user",
  Project = "project",
}
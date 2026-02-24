export enum SubAgentModel {
  Inherit          = "inherit",
  // Anthropic Claude
  Haiku35          = "claude-haiku-3-5",
  Sonnet35         = "claude-sonnet-3-5",
  Sonnet37         = "claude-sonnet-3-7",
  Opus4            = "claude-opus-4",
  Sonnet4          = "claude-sonnet-4",
  // OpenAI
  GPT4o            = "gpt-4o",
  GPT4oMini        = "gpt-4o-mini",
  O3               = "o3",
  O3Mini           = "o3-mini",
  O4Mini           = "o4-mini",
  // Google Gemini
  Gemini25Pro      = "gemini-2.5-pro",
  Gemini25Flash    = "gemini-2.5-flash",
  // xAI
  Grok3            = "grok-3",
  Grok3Mini        = "grok-3-mini",
  // DeepSeek
  DeepSeekV3       = "deepseek-v3",
  DeepSeekR1       = "deepseek-r1",
}

/** Human-readable display names for each model */
export const MODEL_DISPLAY_NAMES: Record<SubAgentModel, string> = {
  [SubAgentModel.Inherit]:       "Inherit from parent",
  [SubAgentModel.Haiku35]:       "Claude Haiku 3.5",
  [SubAgentModel.Sonnet35]:      "Claude Sonnet 3.5",
  [SubAgentModel.Sonnet37]:      "Claude Sonnet 3.7",
  [SubAgentModel.Opus4]:         "Claude Opus 4",
  [SubAgentModel.Sonnet4]:       "Claude Sonnet 4",
  [SubAgentModel.GPT4o]:         "GPT-4o",
  [SubAgentModel.GPT4oMini]:     "GPT-4o Mini",
  [SubAgentModel.O3]:            "o3",
  [SubAgentModel.O3Mini]:        "o3-mini",
  [SubAgentModel.O4Mini]:        "o4-mini",
  [SubAgentModel.Gemini25Pro]:   "Gemini 2.5 Pro",
  [SubAgentModel.Gemini25Flash]: "Gemini 2.5 Flash",
  [SubAgentModel.Grok3]:         "Grok 3",
  [SubAgentModel.Grok3Mini]:     "Grok 3 Mini",
  [SubAgentModel.DeepSeekV3]:    "DeepSeek V3",
  [SubAgentModel.DeepSeekR1]:    "DeepSeek R1",
};

export enum SubAgentMemory {
  Default = "-",
  Local   = "local",
  User    = "user",
  Project = "project",
}
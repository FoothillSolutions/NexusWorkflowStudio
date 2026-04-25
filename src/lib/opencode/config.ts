import { readStorageValue, writeStorageValue } from "@/lib/browser-storage";

export const OPENCODE_STORAGE_KEY = "nexus:opencode-url";
/** Default Claude Code bridge endpoint. */
export const DEFAULT_ACP_BRIDGE_URL = "http://127.0.0.1:4080";
/** Default OpenCode bridge endpoint. Uses a distinct port so it can run side-by-side with the Claude Code bridge. */
export const DEFAULT_OPENCODE_BRIDGE_URL = "http://127.0.0.1:4081";
export const DEFAULT_OPENCODE_URL = DEFAULT_ACP_BRIDGE_URL;

export interface AIConnectionPreset {
  id: string;
  label: string;
  badge?: string;
  description: string;
  url: string;
  startCommand: string;
}

export function getAIConnectionPresets(origin?: string): AIConnectionPreset[] {
  const corsOrigin = origin?.trim() || "http://localhost:3000";

  return [
    {
      id: "claude-code-bridge",
      label: "Claude Code",
      badge: "Recommended",
      description: "Route prompts to Claude Code.",
      url: DEFAULT_ACP_BRIDGE_URL,
      startCommand: `bun run bridge --agent claude --cors "${corsOrigin}"`,
    },
    {
      id: "opencode-bridge",
      label: "OpenCode",
      description: "Use OpenCode as the backend runtime.",
      url: DEFAULT_OPENCODE_BRIDGE_URL,
      startCommand: `bun run bridge --agent opencode --cors "${corsOrigin}"`,
    },
  ];
}

export function loadOpenCodeUrl(): string {
  return readStorageValue(OPENCODE_STORAGE_KEY) ?? DEFAULT_OPENCODE_URL;
}

export function saveOpenCodeUrl(url: string): void {
  writeStorageValue(OPENCODE_STORAGE_KEY, url);
}


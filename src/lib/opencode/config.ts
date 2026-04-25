import { readStorageValue, writeStorageValue } from "@/lib/browser-storage";

export const OPENCODE_STORAGE_KEY = "nexus:opencode-url";
export const DEFAULT_ACP_BRIDGE_URL = "http://127.0.0.1:4080";
export const DEFAULT_DIRECT_OPENCODE_URL = "http://127.0.0.1:4096";
export const DEFAULT_OPENCODE_URL = DEFAULT_ACP_BRIDGE_URL;

export interface AIConnectionPreset {
  id: string;
  label: string;
  badge: string;
  description: string;
  url: string;
  installCommand?: string;
  setupCommand?: string;
  startCommand: string;
}

export function getAIConnectionPresets(origin?: string): AIConnectionPreset[] {
  const corsOrigin = origin?.trim() || "http://localhost:3000";

  return [
    {
      id: "claude-code-bridge",
      label: "Claude Code via ACP bridge",
      badge: "Recommended",
      description: "Use the bundled ACP bridge and route prompts to Claude Code.",
      url: DEFAULT_ACP_BRIDGE_URL,
      setupCommand: "bun run bridge:setup-claude",
      startCommand: `bun run bridge --agent claude --cors "${corsOrigin}"`,
    },
    {
      id: "opencode-bridge",
      label: "OpenCode via ACP bridge",
      badge: "ACP bridge",
      description: "Keep Nexus on the ACP bridge while using OpenCode as the backend runtime.",
      url: DEFAULT_ACP_BRIDGE_URL,
      installCommand: "bun add -g opencode-ai",
      startCommand: `bun run bridge --agent opencode --cors "${corsOrigin}"`,
    },
    {
      id: "opencode-direct",
      label: "Direct OpenCode server",
      badge: "Direct",
      description: "Connect straight to an OpenCode HTTP server without the ACP bridge.",
      url: DEFAULT_DIRECT_OPENCODE_URL,
      installCommand: "bun add -g opencode-ai",
      startCommand: `opencode serve --cors ${corsOrigin}`,
    },
  ];
}

export function loadOpenCodeUrl(): string {
  return readStorageValue(OPENCODE_STORAGE_KEY) ?? DEFAULT_OPENCODE_URL;
}

export function saveOpenCodeUrl(url: string): void {
  writeStorageValue(OPENCODE_STORAGE_KEY, url);
}


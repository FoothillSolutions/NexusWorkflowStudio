import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface BridgeToolPreset {
  id: string;
  label: string;
  description: string;
  resolveEnv(): Record<string, string>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const CLAUDE_CODE_VENDOR_BIN = path.resolve(
  here,
  "..",
  "vendor",
  "claude-code",
  "node_modules",
  ".bin",
  "claude-agent-acp",
);

let warnedAboutMissingVendor = false;

function resolveClaudeCodeCommand(): { command: string; args: string } {
  if (fs.existsSync(CLAUDE_CODE_VENDOR_BIN)) {
    return { command: CLAUDE_CODE_VENDOR_BIN, args: "" };
  }

  if (!warnedAboutMissingVendor) {
    warnedAboutMissingVendor = true;
    console.warn(
      "[nexus-acp-bridge] claude-code vendored install not found. " +
        "Run `bun run bridge:setup-claude` to vendor @agentclientprotocol/claude-agent-acp locally. " +
        "Falling back to `npx --yes @agentclientprotocol/claude-agent-acp`.",
    );
  }

  return { command: "npx", args: "--yes @agentclientprotocol/claude-agent-acp@0.31.0" };
}

export const BRIDGE_TOOL_PRESETS: Record<string, BridgeToolPreset> = {
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    description: "Claude Code via the ACP wrapper package.",
    resolveEnv: () => {
      const { command, args } = resolveClaudeCodeCommand();
      return {
        NEXUS_ACP_BRIDGE_ADAPTER: "acp",
        NEXUS_ACP_BRIDGE_PROVIDER_ID: "claude-code",
        NEXUS_ACP_BRIDGE_PROVIDER_NAME: "Claude Code",
        NEXUS_ACP_BRIDGE_MODEL_ID: "sonnet",
        NEXUS_ACP_BRIDGE_MODEL_NAME: "Claude Sonnet",
        NEXUS_ACP_BRIDGE_AGENT_COMMAND: command,
        NEXUS_ACP_BRIDGE_AGENT_ARGS: args,
        ACP_PERMISSION_MODE: "bypassPermissions",
      };
    },
  },
  codex: {
    id: "codex",
    label: "Codex ACP",
    description: "Codex via the Zed ACP wrapper package.",
    resolveEnv: () => ({
      NEXUS_ACP_BRIDGE_ADAPTER: "acp",
      NEXUS_ACP_BRIDGE_PROVIDER_ID: "codex",
      NEXUS_ACP_BRIDGE_PROVIDER_NAME: "Codex",
      NEXUS_ACP_BRIDGE_MODEL_ID: "default",
      NEXUS_ACP_BRIDGE_MODEL_NAME: "Codex Default Model",
      NEXUS_ACP_BRIDGE_AGENT_COMMAND: "npx",
      NEXUS_ACP_BRIDGE_AGENT_ARGS: "--yes @zed-industries/codex-acp",
    }),
  },
  opencode: {
    id: "opencode",
    label: "OpenCode ACP",
    description: "OpenCode running in ACP process mode.",
    resolveEnv: () => ({
      NEXUS_ACP_BRIDGE_ADAPTER: "acp",
      NEXUS_ACP_BRIDGE_PROVIDER_ID: "opencode",
      NEXUS_ACP_BRIDGE_PROVIDER_NAME: "OpenCode",
      NEXUS_ACP_BRIDGE_MODEL_ID: "default",
      NEXUS_ACP_BRIDGE_MODEL_NAME: "OpenCode Default Model",
      NEXUS_ACP_BRIDGE_AGENT_COMMAND: "opencode",
      NEXUS_ACP_BRIDGE_AGENT_ARGS: "acp",
    }),
  },
};

export const BRIDGE_TOOL_PRESET_IDS = Object.keys(BRIDGE_TOOL_PRESETS);

export function getBridgeToolPreset(toolId: string | null | undefined): BridgeToolPreset | null {
  if (!toolId) return null;
  return BRIDGE_TOOL_PRESETS[toolId] ?? null;
}

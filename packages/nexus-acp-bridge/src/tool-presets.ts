import fs from "node:fs";
import { CLAUDE_AGENT_ACP_VERSION, CLAUDE_VENDOR_BIN, ensureClaudeAcpVendored } from "./vendor-claude-acp";

export interface BridgeToolPreset {
  id: string;
  label: string;
  description: string;
  resolveEnv(): Record<string, string>;
}

let warnedAboutMissingVendor = false;

function autoSetupEnabled(): boolean {
  const raw = process.env.NEXUS_ACP_BRIDGE_AUTO_SETUP_CLAUDE?.trim().toLowerCase();
  // Default ON. Opt-out with NEXUS_ACP_BRIDGE_AUTO_SETUP_CLAUDE=0 / false / off / no.
  if (!raw) return true;
  return !["0", "false", "no", "off"].includes(raw);
}

function resolveClaudeCodeCommand(): { command: string; args: string } {
  if (fs.existsSync(CLAUDE_VENDOR_BIN)) {
    return { command: CLAUDE_VENDOR_BIN, args: "" };
  }

  if (autoSetupEnabled()) {
    console.log(
      "[nexus-acp-bridge] claude-code vendored install missing — auto-installing " +
        `@agentclientprotocol/claude-agent-acp@${CLAUDE_AGENT_ACP_VERSION}. ` +
        "Set NEXUS_ACP_BRIDGE_AUTO_SETUP_CLAUDE=0 to opt out.",
    );
    const installed = ensureClaudeAcpVendored({
      silent: true,
      log: (msg) => console.log(`[nexus-acp-bridge] ${msg}`),
    });
    if (installed) {
      return { command: installed, args: "" };
    }
  }

  if (!warnedAboutMissingVendor) {
    warnedAboutMissingVendor = true;
    console.warn(
      "[nexus-acp-bridge] claude-code vendored install not found. " +
        "Run `bun run bridge:setup-claude` to vendor @agentclientprotocol/claude-agent-acp locally. " +
        `Falling back to \`npx --yes @agentclientprotocol/claude-agent-acp@${CLAUDE_AGENT_ACP_VERSION}\`.`,
    );
  }

  return { command: "npx", args: `--yes @agentclientprotocol/claude-agent-acp@${CLAUDE_AGENT_ACP_VERSION}` };
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
      // Use `bunx` so OpenCode is installed/cached on demand — users no longer
      // need to `bun add -g opencode-ai` manually.
      NEXUS_ACP_BRIDGE_AGENT_COMMAND: "bunx",
      NEXUS_ACP_BRIDGE_AGENT_ARGS: "opencode-ai acp",
    }),
  },
};

export const BRIDGE_TOOL_PRESET_IDS = Object.keys(BRIDGE_TOOL_PRESETS);

export function getBridgeToolPreset(toolId: string | null | undefined): BridgeToolPreset | null {
  if (!toolId) return null;
  return BRIDGE_TOOL_PRESETS[toolId] ?? null;
}

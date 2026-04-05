import path from "node:path";
import type { BridgeConfig } from "./types";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = readEnv(name);
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readNumber(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readCsv(name: string): string[] {
  const raw = readEnv(name);
  if (!raw) return [];
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

function parseCommandArgs(raw: string | undefined): string[] {
  if (!raw) return [];

  const matches = raw.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s]+/g) ?? [];
  return matches
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (
        (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        return token.slice(1, -1);
      }
      return token;
    });
}

export function loadBridgeConfig(): BridgeConfig {
  const explicitProjectDirs = readCsv("NEXUS_ACP_BRIDGE_PROJECT_DIRS");
  const singleProjectDir = readEnv("NEXUS_ACP_BRIDGE_PROJECT_DIR");
  const defaultProjectDir = path.resolve(singleProjectDir ?? process.cwd());
  const projectDirs = (explicitProjectDirs.length > 0
    ? explicitProjectDirs
    : [defaultProjectDir])
    .map((dir) => path.resolve(dir));

  const defaultTools = readCsv("NEXUS_ACP_BRIDGE_TOOLS");
  const adapterModeRaw = readEnv("NEXUS_ACP_BRIDGE_ADAPTER");
  const adapterMode = adapterModeRaw === "stdio" || adapterModeRaw === "acp"
    ? adapterModeRaw
    : "mock";
  const agentCommand = readEnv("NEXUS_ACP_BRIDGE_AGENT_COMMAND") ?? null;
  const agentCwd = readEnv("NEXUS_ACP_BRIDGE_AGENT_CWD");
  const acpProtocol = readEnv("NEXUS_ACP_BRIDGE_ACP_PROTOCOL") === "newline"
    ? "newline"
    : "content-length";

  return {
    adapterMode,
    host: readEnv("NEXUS_ACP_BRIDGE_HOST") ?? "127.0.0.1",
    port: readNumber("NEXUS_ACP_BRIDGE_PORT", 4080),
    corsOrigin: readEnv("NEXUS_ACP_BRIDGE_CORS_ORIGIN") ?? "http://localhost:3000",
    version: readEnv("NEXUS_ACP_BRIDGE_VERSION") ?? "0.1.0",
    projectDirs,
    allowArbitraryDirectories: readBoolean("NEXUS_ACP_BRIDGE_ALLOW_ARBITRARY_DIRECTORIES", false),
    defaultProviderId: readEnv("NEXUS_ACP_BRIDGE_PROVIDER_ID") ?? "acp",
    defaultProviderName: readEnv("NEXUS_ACP_BRIDGE_PROVIDER_NAME") ?? "ACP Bridge",
    defaultModelId: readEnv("NEXUS_ACP_BRIDGE_MODEL_ID") ?? "default",
    defaultModelName: readEnv("NEXUS_ACP_BRIDGE_MODEL_NAME") ?? "ACP Default Model",
    defaultTools: defaultTools.length > 0
      ? defaultTools
      : [
        "read_file",
        "grep_search",
        "semantic_search",
        "apply_patch",
        "run_in_terminal",
      ],
    agentCommand,
    agentArgs: parseCommandArgs(readEnv("NEXUS_ACP_BRIDGE_AGENT_ARGS")),
    agentCwd: agentCwd ? path.resolve(agentCwd) : null,
    acpProtocol,
    acpMethods: {
      initialize: readEnv("NEXUS_ACP_BRIDGE_ACP_METHOD_INITIALIZE") ?? "initialize",
      health: readEnv("NEXUS_ACP_BRIDGE_ACP_METHOD_HEALTH") ?? null,
      models: readEnv("NEXUS_ACP_BRIDGE_ACP_METHOD_MODELS") ?? "models/list",
      tools: readEnv("NEXUS_ACP_BRIDGE_ACP_METHOD_TOOLS") ?? "tools/list",
      resources: readEnv("NEXUS_ACP_BRIDGE_ACP_METHOD_RESOURCES") ?? "resources/list",
      mcpStatus: readEnv("NEXUS_ACP_BRIDGE_ACP_METHOD_MCP_STATUS") ?? "mcp/status",
      generate: readEnv("NEXUS_ACP_BRIDGE_ACP_METHOD_GENERATE") ?? "message/send",
      cancel: readEnv("NEXUS_ACP_BRIDGE_ACP_METHOD_CANCEL") ?? "message/cancel",
    },
    acpNotifications: {
      textDelta: readEnv("NEXUS_ACP_BRIDGE_ACP_NOTIFICATION_DELTA") ?? "message/delta",
      completed: readEnv("NEXUS_ACP_BRIDGE_ACP_NOTIFICATION_COMPLETED") ?? "message/completed",
      failed: readEnv("NEXUS_ACP_BRIDGE_ACP_NOTIFICATION_FAILED") ?? "message/error",
    },
    mockStreamDelayMs: readNumber("NEXUS_ACP_BRIDGE_STREAM_DELAY_MS", 12),
  };
}

export const __private__ = {
  parseCommandArgs,
};



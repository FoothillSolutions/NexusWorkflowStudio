import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRIDGE_TOOL_PRESET_IDS, getBridgeToolPreset } from "./tool-presets";
import type { BridgeConfig } from "./types";

const BUNDLED_ENV_FILES = [
  new URL("../.env.defaults", import.meta.url),
  new URL("../.env.local", import.meta.url),
];

function parseEnvValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  const commentIndex = trimmed.search(/\s+#/);
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trimEnd() : trimmed;
}

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    const rawValue = normalized.slice(equalsIndex + 1);
    if (!key) continue;

    values[key] = parseEnvValue(rawValue);
  }

  return values;
}

function applyBundledEnvDefaults(shellSnapshot: Record<string, string | undefined>): void {
  for (const fileUrl of BUNDLED_ENV_FILES) {
    const filePath = fileURLToPath(fileUrl);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    const values = parseEnvFile(content);
    for (const [key, value] of Object.entries(values)) {
      if (shellSnapshot[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function parseCliArgs(argv: string[]): { tool: string | null } {
  let tool: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === "--tool") {
      tool = argv[index + 1]?.trim() || null;
      index += 1;
      continue;
    }

    if (arg.startsWith("--tool=")) {
      tool = arg.slice("--tool=".length).trim() || null;
    }
  }

  return { tool };
}

function applyToolPreset(
  selectedTool: string | null,
  shellSnapshot: Record<string, string | undefined>,
): void {
  if (!selectedTool) return;

  const preset = getBridgeToolPreset(selectedTool);
  if (!preset) {
    throw new Error(
      `Unknown bridge tool preset: ${selectedTool}. Supported presets: ${BRIDGE_TOOL_PRESET_IDS.join(", ")}`,
    );
  }

  for (const [key, value] of Object.entries(preset.resolveEnv())) {
    if (shellSnapshot[key] === undefined) {
      process.env[key] = value;
    }
  }
}

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

export function loadBridgeConfig(argv: string[] = process.argv.slice(2)): BridgeConfig {
  const shellSnapshot: Record<string, string | undefined> = { ...process.env };
  applyBundledEnvDefaults(shellSnapshot);
  const cliArgs = parseCliArgs(argv);
  const selectedTool = cliArgs.tool ?? shellSnapshot.NEXUS_ACP_BRIDGE_TOOL ?? readEnv("NEXUS_ACP_BRIDGE_TOOL") ?? null;
  applyToolPreset(selectedTool, shellSnapshot);

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
  const acpProtocol = readEnv("NEXUS_ACP_BRIDGE_ACP_PROTOCOL") === "content-length"
    ? "content-length"
    : "newline";

  return {
    adapterMode,
    selectedTool,
    host: readEnv("NEXUS_ACP_BRIDGE_HOST") ?? "127.0.0.1",
    port: readNumber("NEXUS_ACP_BRIDGE_PORT", 4080),
    serverIdleTimeoutSeconds: Math.max(0, readNumber("NEXUS_ACP_BRIDGE_IDLE_TIMEOUT_SECONDS", 0)),
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
    acpProtocolVersion: readNumber("NEXUS_ACP_BRIDGE_ACP_PROTOCOL_VERSION", 1),
    mockStreamDelayMs: readNumber("NEXUS_ACP_BRIDGE_STREAM_DELAY_MS", 12),
    maxFileReadBytes: readNumber("NEXUS_ACP_BRIDGE_MAX_FILE_READ_BYTES", 2 * 1024 * 1024),
  };
}

export const __private__ = {
  parseCliArgs,
  parseEnvFile,
  parseCommandArgs,
};



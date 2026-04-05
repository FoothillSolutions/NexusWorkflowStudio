import type { BridgeConfig, GenerateTextRequest } from "../types";

export function makeBridgeConfig(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    adapterMode: "mock",
    host: "127.0.0.1",
    port: 4080,
    corsOrigin: "http://localhost:3000",
    version: "test",
    projectDirs: [process.cwd()],
    allowArbitraryDirectories: false,
    defaultProviderId: "acp",
    defaultProviderName: "ACP",
    defaultModelId: "model",
    defaultModelName: "Model",
    defaultTools: ["read_file", "apply_patch"],
    agentCommand: null,
    agentArgs: [],
    agentCwd: null,
    acpProtocol: "newline",
    acpMethods: {
      initialize: "initialize",
      health: "health",
      models: "models/list",
      tools: "tools/list",
      resources: "resources/list",
      mcpStatus: "mcp/status",
      generate: "message/send",
      cancel: "message/cancel",
    },
    acpNotifications: {
      textDelta: "message/delta",
      completed: "message/completed",
      failed: "message/error",
    },
    mockStreamDelayMs: 0,
    ...overrides,
  };
}

export function makeGenerateTextRequest(): GenerateTextRequest {
  return {
    session: {
      id: "session-1",
      slug: "session-1",
      projectID: "project-1",
      directory: process.cwd(),
      title: "Session",
      version: "test",
      time: { created: Date.now(), updated: Date.now() },
    },
    project: {
      id: "project-1",
      worktree: process.cwd(),
      name: "Nexus",
      time: { created: Date.now(), updated: Date.now() },
      sandboxes: [],
    },
    payload: {
      parts: [{ type: "text", text: "hello from nexus" }],
      system: "system prompt",
      model: { providerID: "acp", modelID: "model" },
    },
    signal: new AbortController().signal,
  };
}


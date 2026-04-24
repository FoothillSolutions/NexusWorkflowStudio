import type { BridgeConfig, GenerateTextRequest } from "../types";

export function makeBridgeConfig(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    adapterMode: "mock",
    selectedTool: null,
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
    acpProtocolVersion: 1,
    mockStreamDelayMs: 0,
    maxFileReadBytes: 2 * 1024 * 1024,
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


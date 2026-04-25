import type {
  BridgeConfig,
  ConfigProviders,
  MCPStatus,
  McpResource,
  Model,
  Project,
  ToolListItem,
} from "./types";

const STABLE_RELEASE_DATE = "1970-01-01T00:00:00Z";

interface ModelSeed {
  id: string;
  name: string;
  family?: string;
}

const CLAUDE_CODE_MODELS: ModelSeed[] = [
  { id: "haiku", name: "Claude Haiku", family: "claude-haiku" },
  { id: "sonnet", name: "Claude Sonnet", family: "claude-sonnet" },
  { id: "opus", name: "Claude Opus", family: "claude-opus" },
];

function resolveProviderModels(config: BridgeConfig): ModelSeed[] {
  if (config.selectedTool === "claude-code" || config.defaultProviderId === "claude-code") {
    return CLAUDE_CODE_MODELS;
  }

  return [{
    id: config.defaultModelId,
    name: config.defaultModelName,
    family: config.defaultModelId === "default" ? "acp" : config.defaultModelId,
  }];
}

export function buildDefaultModel(config: BridgeConfig, source: string, seed?: ModelSeed): Model {
  return {
    id: seed?.id ?? config.defaultModelId,
    providerID: config.defaultProviderId,
    api: {
      id: config.defaultProviderId,
      url: `https://example.invalid/${source}`,
      npm: "nexus-acp-bridge",
    },
    name: seed?.name ?? config.defaultModelName,
    family: seed?.family ?? (config.defaultModelId === "default" ? "acp" : config.defaultModelId),
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { output: 8192, context: 200000 },
    status: "active",
    options: {},
    headers: {},
    release_date: STABLE_RELEASE_DATE,
  };
}

export function buildDefaultConfigProviders(config: BridgeConfig, source: string): ConfigProviders {
  const models = Object.fromEntries(
    resolveProviderModels(config).map((seed) => [seed.id, buildDefaultModel(config, source, seed)]),
  );

  return {
    providers: [
      {
        id: config.defaultProviderId,
        name: config.defaultProviderName,
        source: "api",
        env: [],
        options: {},
        models,
      },
    ],
    default: { [config.defaultProviderId]: config.defaultModelId },
  };
}

export function buildDefaultTools(config: BridgeConfig): ToolListItem[] {
  return config.defaultTools.map((tool) => ({
    id: tool,
    description: `Bridge-exposed tool: ${tool}`,
    parameters: { type: "object", properties: {} },
  }));
}

export function buildDefaultMcpStatus(config: BridgeConfig): Record<string, MCPStatus> {
  return { [config.defaultProviderId]: { status: "connected" } };
}

export function buildDefaultResources(
  config: BridgeConfig,
  project: Project,
  description: string,
): Record<string, McpResource> {
  return {
    project: {
      name: `${project.name ?? "project"} root`,
      uri: `file://${project.worktree}`,
      client: config.defaultProviderId,
      description,
    },
  };
}

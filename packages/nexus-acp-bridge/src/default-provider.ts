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

export function buildDefaultModel(config: BridgeConfig, source: string): Model {
  return {
    id: config.defaultModelId,
    providerID: config.defaultProviderId,
    api: {
      id: config.defaultProviderId,
      url: `https://example.invalid/${source}`,
      npm: "nexus-acp-bridge",
    },
    name: config.defaultModelName,
    family: "acp",
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
  return {
    providers: [
      {
        id: config.defaultProviderId,
        name: config.defaultProviderName,
        source: "api",
        env: [],
        options: {},
        models: {
          [config.defaultModelId]: buildDefaultModel(config, source),
        },
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

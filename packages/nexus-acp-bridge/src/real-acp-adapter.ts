import { AsyncQueue } from "./acp-async-queue";
import { ACPJsonRpcClient, type ACPJsonRpcClientLike } from "./acp-jsonrpc-client";
import type {
  ACPAdapter,
  BridgeConfig,
  ConfigProviders,
  GenerateTextRequest,
  HealthInfo,
  MCPStatus,
  McpResource,
  Model,
  Project,
  ToolListItem,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function extractArray(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  for (const key of keys) {
    const maybe = record[key];
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
}

function ensureConfigProviders(result: unknown, config: BridgeConfig): ConfigProviders {
  const record = asRecord(result);
  if (record && Array.isArray(record.providers)) {
    return {
      providers: record.providers as ConfigProviders["providers"],
      default: asRecord(record.default) as Record<string, string> ?? { [config.defaultProviderId]: config.defaultModelId },
    };
  }

  const models = extractArray(result, "models", "items", "data");
  const normalizedModels: Record<string, Model> = {};
  for (const item of models) {
    const candidate = asRecord(item);
    if (!candidate) continue;
    const id = asString(candidate.id) ?? asString(candidate.modelID) ?? asString(candidate.name);
    if (!id) continue;
    normalizedModels[id] = {
      id,
      providerID: config.defaultProviderId,
      api: { id: config.defaultProviderId, url: "https://example.invalid/acp", npm: "nexus-acp-bridge" },
      name: asString(candidate.name) ?? id,
      family: asString(candidate.family) ?? undefined,
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
      limit: { output: 8192 },
      status: "active",
      options: {},
      headers: {},
      release_date: new Date().toISOString(),
    };
  }

  if (Object.keys(normalizedModels).length === 0) {
    normalizedModels[config.defaultModelId] = {
      id: config.defaultModelId,
      providerID: config.defaultProviderId,
      api: { id: config.defaultProviderId, url: "https://example.invalid/acp", npm: "nexus-acp-bridge" },
      name: config.defaultModelName,
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
      limit: { output: 8192 },
      status: "active",
      options: {},
      headers: {},
      release_date: new Date().toISOString(),
    };
  }

  return {
    providers: [{
      id: config.defaultProviderId,
      name: config.defaultProviderName,
      source: "api",
      env: [],
      options: {},
      models: normalizedModels,
    }],
    default: { [config.defaultProviderId]: Object.keys(normalizedModels)[0] ?? config.defaultModelId },
  };
}

function ensureToolList(result: unknown, config: BridgeConfig): ToolListItem[] {
  const items = extractArray(result, "tools", "items", "data");
  const normalized = items.flatMap((item): ToolListItem[] => {
    if (typeof item === "string") {
      return [{ id: item, description: item, parameters: { type: "object", properties: {} } }];
    }
    const record = asRecord(item);
    if (!record) return [];
    const id = asString(record.id) ?? asString(record.name);
    if (!id) return [];
    return [{
      id,
      description: asString(record.description) ?? id,
      parameters: record.parameters ?? record.inputSchema ?? { type: "object", properties: {} },
    }];
  });

  return normalized.length > 0
    ? normalized
    : config.defaultTools.map((tool) => ({
      id: tool,
      description: tool,
      parameters: { type: "object", properties: {} },
    }));
}

function ensureResources(result: unknown, project: Project, config: BridgeConfig): Record<string, McpResource> {
  const record = asRecord(result);
  if (record && !Array.isArray(result)) {
    const mapped = Object.entries(record).reduce<Record<string, McpResource>>((acc, [key, value]) => {
      const resource = asRecord(value);
      if (!resource) return acc;
      acc[key] = {
        name: asString(resource.name) ?? key,
        uri: asString(resource.uri) ?? `acp://${key}`,
        client: asString(resource.client) ?? config.defaultProviderId,
        description: asString(resource.description) ?? undefined,
        mimeType: asString(resource.mimeType) ?? undefined,
      };
      return acc;
    }, {});
    if (Object.keys(mapped).length > 0) return mapped;
  }

  const items = extractArray(result, "resources", "items", "data");
  const mapped = items.reduce<Record<string, McpResource>>((acc, item, index) => {
    const resource = asRecord(item);
    if (!resource) return acc;
    const key = asString(resource.id) ?? asString(resource.name) ?? `resource-${index + 1}`;
    acc[key] = {
      name: asString(resource.name) ?? key,
      uri: asString(resource.uri) ?? `acp://${key}`,
      client: asString(resource.client) ?? config.defaultProviderId,
      description: asString(resource.description) ?? undefined,
      mimeType: asString(resource.mimeType) ?? undefined,
    };
    return acc;
  }, {});

  if (Object.keys(mapped).length > 0) return mapped;

  return {
    project: {
      name: `${project.name ?? "project"} root`,
      uri: `file://${project.worktree}`,
      client: config.defaultProviderId,
      description: "Fallback project root resource.",
    },
  };
}

function ensureMcpStatus(result: unknown, config: BridgeConfig): Record<string, MCPStatus> {
  const record = asRecord(result);
  if (record) {
    const mapped = Object.entries(record).reduce<Record<string, MCPStatus>>((acc, [key, value]) => {
      const entry = asRecord(value);
      const status = asString(entry?.status);
      if (!status) return acc;
      if (status === "connected" || status === "disabled" || status === "needs_auth") {
        acc[key] = { status };
      } else if (status === "failed" || status === "needs_client_registration") {
        acc[key] = { status, error: asString(entry?.error) ?? "ACP backend error" } as MCPStatus;
      }
      return acc;
    }, {});
    if (Object.keys(mapped).length > 0) return mapped;
  }

  return { [config.defaultProviderId]: { status: "connected" } };
}

function extractNotificationText(params: unknown): string | null {
  const record = asRecord(params);
  if (!record) return null;
  return asString(record.delta)
    ?? asString(record.text)
    ?? asString(record.content)
    ?? asString(asRecord(record.message)?.text)
    ?? null;
}

function extractErrorMessage(params: unknown): string {
  const record = asRecord(params);
  return asString(record?.message)
    ?? asString(asRecord(record?.error)?.message)
    ?? "ACP generation failed";
}

function extractStreamKey(result: unknown): string | null {
  const record = asRecord(result);
  return asString(record?.streamId)
    ?? asString(record?.requestId)
    ?? asString(record?.messageId)
    ?? null;
}

function notificationBelongsToRequest(params: unknown, requestToken: string, streamKey: string | null, sessionId: string): boolean {
  const record = asRecord(params);
  if (!record) return streamKey === null;

  const candidates = [
    asString(record.requestId),
    asString(record.requestID),
    asString(record.streamId),
    asString(record.messageId),
    asString(record.sessionId),
    asString(record.sessionID),
    asString(record.bridgeSessionId),
    asString(asRecord(record.metadata)?.requestId),
    asString(asRecord(record.metadata)?.bridgeSessionId),
  ].filter(Boolean);

  if (candidates.includes(requestToken) || candidates.includes(sessionId)) {
    return true;
  }

  if (streamKey && candidates.includes(streamKey)) {
    return true;
  }

  return candidates.length === 0;
}

function extractResultText(result: unknown): string | null {
  if (typeof result === "string") return result;
  const record = asRecord(result);
  if (!record) return null;
  return asString(record.text)
    ?? asString(record.content)
    ?? asString(asRecord(record.message)?.text)
    ?? null;
}

export class RealACPAdapter implements ACPAdapter {
  private readonly client: ACPJsonRpcClientLike;

  constructor(
    private readonly config: BridgeConfig,
    client?: ACPJsonRpcClientLike,
  ) {
    this.client = client ?? new ACPJsonRpcClient(config);
  }

  async dispose(): Promise<void> {
    await this.client.close();
  }

  async getHealth(): Promise<HealthInfo> {
    await this.client.connect();
    if (this.config.acpMethods.health) {
      const result = await this.client.request<unknown>(this.config.acpMethods.health);
      const record = asRecord(result);
      return {
        healthy: true,
        version: asString(record?.version) ?? `${this.config.version}-acp`,
      };
    }

    return {
      healthy: true,
      version: `${this.config.version}-acp`,
    };
  }

  async getConfigProviders(): Promise<ConfigProviders> {
    const result = await this.client.request<unknown>(this.config.acpMethods.models, {});
    return ensureConfigProviders(result, this.config);
  }

  async listTools(input: { provider: string; model: string; project: Project }): Promise<ToolListItem[]> {
    const result = await this.client.request<unknown>(this.config.acpMethods.tools, {
      provider: input.provider,
      model: input.model,
      project: input.project,
    });
    return ensureToolList(result, this.config);
  }

  async getMcpStatus(input: { project: Project }): Promise<Record<string, MCPStatus>> {
    const result = await this.client.request<unknown>(this.config.acpMethods.mcpStatus, {
      project: input.project,
    });
    return ensureMcpStatus(result, this.config);
  }

  async listResources(input: { project: Project }): Promise<Record<string, McpResource>> {
    const result = await this.client.request<unknown>(this.config.acpMethods.resources, {
      project: input.project,
    });
    return ensureResources(result, input.project, this.config);
  }

  async *generateText(request: GenerateTextRequest): AsyncIterable<string> {
    const queue = new AsyncQueue<string>();
    const requestToken = crypto.randomUUID();
    let streamKey: string | null = null;

    const unsubscribe = this.client.onNotification((notification) => {
      const params = notification.params;
      if (!notificationBelongsToRequest(params, requestToken, streamKey, request.session.id)) {
        return;
      }

      if (notification.method === this.config.acpNotifications.textDelta) {
        const text = extractNotificationText(params);
        if (text) {
          queue.push(text);
        }
        return;
      }

      if (notification.method === this.config.acpNotifications.completed) {
        queue.close();
        return;
      }

      if (notification.method === this.config.acpNotifications.failed) {
        queue.fail(new Error(extractErrorMessage(params)));
      }
    });

    const abortHandler = () => {
      if (this.config.acpMethods.cancel) {
        void this.client.notify(this.config.acpMethods.cancel, {
          requestId: requestToken,
          sessionId: request.session.id,
        }).catch(() => {});
      }
      queue.close();
    };
    request.signal.addEventListener("abort", abortHandler, { once: true });

    try {
      const result = await this.client.request<unknown>(this.config.acpMethods.generate, {
        sessionId: request.session.id,
        project: request.project,
        model: request.payload.model,
        system: request.payload.system,
        parts: request.payload.parts,
        metadata: {
          requestId: requestToken,
          bridgeSessionId: request.session.id,
        },
      });
      streamKey = extractStreamKey(result);

      const immediateText = extractResultText(result);
      if (immediateText) {
        queue.push(immediateText);
        queue.close();
      }

      for await (const chunk of queue) {
        if (request.signal.aborted) break;
        yield chunk;
      }
    } finally {
      request.signal.removeEventListener("abort", abortHandler);
      unsubscribe();
    }
  }
}



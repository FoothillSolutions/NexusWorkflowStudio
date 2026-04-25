import fs from "node:fs/promises";
import path from "node:path";
import { AsyncQueue } from "../transport/async-queue";
import { ACPJsonRpcClient, type ACPJsonRpcClientLike } from "../transport/jsonrpc-client";
import {
  buildDefaultConfigProviders,
  buildDefaultMcpStatus,
  buildDefaultResources,
  buildDefaultTools,
} from "../server/default-provider";
import type {
  ACPAdapter,
  BridgeConfig,
  Command,
  ConfigProviders,
  GenerateTextRequest,
  HealthInfo,
  MCPStatus,
  McpResource,
  Model,
  Project,
  Provider,
  ToolListItem,
} from "../types";

const DISCOVERED_RELEASE_DATE = "1970-01-01T00:00:00Z";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function pickAllowOptionId(options: unknown): string | null {
  if (!Array.isArray(options)) return null;
  for (const entry of options) {
    const record = asRecord(entry);
    if (!record) continue;
    const id = asString(record.optionId) ?? asString(record.id);
    const kind = asString(record.kind);
    if (id && (kind === "allow_once" || kind === "allow_always" || /allow/i.test(id))) {
      return id;
    }
  }
  const first = asRecord(options[0]);
  return asString(first?.optionId) ?? asString(first?.id);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAvailableCommands(value: unknown): Command[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const record = asRecord(entry);
    const name = asString(record?.name);
    if (!name) return [];

    const input = asRecord(record?.input);
    const hint = asString(input?.hint);
    const hints = [
      ...asStringArray(record?.hints),
      ...(hint ? [hint] : []),
    ];

    return [{
      name,
      description: asString(record?.description) ?? undefined,
      source: "command" as const,
      template: `/${name}${hint ? ` {${hint}}` : ""}`,
      hints: [...new Set(hints)],
    } satisfies Command];
  });
}

function splitProviderModel(modelId: string): { providerID: string; modelID: string } | null {
  const separator = modelId.indexOf("/");
  if (separator <= 0 || separator >= modelId.length - 1) return null;

  return {
    providerID: modelId.slice(0, separator),
    modelID: modelId.slice(separator + 1),
  };
}

function humanizeProviderId(providerID: string): string {
  return providerID
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDiscoveredModel(providerID: string, modelID: string, name: string): Model {
  const family = modelID.split("/")[0] ?? modelID;
  return {
    id: modelID,
    providerID,
    api: {
      id: providerID,
      url: "https://example.invalid/acp-discovery",
      npm: "nexus-acp-bridge",
    },
    name,
    family,
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
    release_date: DISCOVERED_RELEASE_DATE,
  };
}

function extractConfigProvidersFromSession(result: unknown): ConfigProviders | null {
  const record = asRecord(result);
  const modelsRecord = asRecord(record?.models);
  const availableModels = asArray(modelsRecord?.availableModels);
  if (availableModels.length === 0) return null;

  const currentModel = splitProviderModel(asString(modelsRecord?.currentModelId) ?? "");
  const providers = new Map<string, { provider: Provider; firstModelId: string | null }>();

  for (const entry of availableModels) {
    const modelRecord = asRecord(entry);
    const fullModelId = asString(modelRecord?.modelId) ?? asString(modelRecord?.value);
    if (!fullModelId) continue;

    const split = splitProviderModel(fullModelId);
    if (!split) continue;

    const fullName = asString(modelRecord?.name) ?? fullModelId;
    const separator = fullName.indexOf("/");
    const providerName = separator > 0 ? fullName.slice(0, separator).trim() : humanizeProviderId(split.providerID);
    const modelName = separator > 0 ? fullName.slice(separator + 1).trim() : fullName;

    let bucket = providers.get(split.providerID);
    if (!bucket) {
      bucket = {
        provider: {
          id: split.providerID,
          name: providerName,
          source: "api",
          env: [],
          options: {},
          models: {},
        },
        firstModelId: null,
      };
      providers.set(split.providerID, bucket);
    }

    if (!bucket.firstModelId) {
      bucket.firstModelId = split.modelID;
    }

    bucket.provider.models[split.modelID] = buildDiscoveredModel(split.providerID, split.modelID, modelName);
  }

  if (providers.size === 0) return null;

  const defaults: Record<string, string> = {};
  for (const [providerID, bucket] of providers.entries()) {
    const currentForProvider = currentModel?.providerID === providerID ? currentModel.modelID : null;
    defaults[providerID] = currentForProvider && bucket.provider.models[currentForProvider]
      ? currentForProvider
      : bucket.firstModelId ?? Object.keys(bucket.provider.models)[0] ?? "default";
  }

  return {
    providers: [...providers.values()].map((bucket) => bucket.provider),
    default: defaults,
  };
}

export class ACPProtocolAdapter implements ACPAdapter {
  private readonly client: ACPJsonRpcClientLike;
  private readonly sessionMap = new Map<string, string>();
  private readonly commandDiscoverySessionMap = new Map<string, string>();
  private readonly commandCache = new Map<string, Command[]>();
  private readonly commandReadyResolvers = new Map<string, () => void>();
  private readonly unregisterCallbacks: Array<() => void> = [];
  private initializePromise: Promise<void> | null = null;
  private initialized = false;

  constructor(
    private readonly config: BridgeConfig,
    client?: ACPJsonRpcClientLike,
  ) {
    this.client = client ?? new ACPJsonRpcClient(config);

    const register = (method: string, handler: (params: unknown) => Promise<unknown> | unknown) => {
      const unregister = this.client.setRequestHandler?.(method, handler);
      if (unregister) this.unregisterCallbacks.push(unregister);
    };

    register("fs/read_text_file", (params) => this.handleReadTextFile(params));
    register("fs/write_text_file", (params) => this.handleWriteTextFile(params));
    register("session/request_permission", (params) => this.handleRequestPermission(params));

    const unregisterNotification = this.client.onNotification((notification) => {
      if (notification.method !== "session/update") return;

      const params = asRecord(notification.params);
      const acpSessionId = asString(params?.sessionId);
      const update = asRecord(params?.update);
      if (!acpSessionId || !update) return;

      if (update.sessionUpdate === "available_commands_update") {
        this.commandCache.set(acpSessionId, normalizeAvailableCommands(update.availableCommands));
        const resolve = this.commandReadyResolvers.get(acpSessionId);
        if (resolve) {
          this.commandReadyResolvers.delete(acpSessionId);
          resolve();
        }
      }
    });
    this.unregisterCallbacks.push(unregisterNotification);
  }

  async dispose(): Promise<void> {
    this.commandDiscoverySessionMap.clear();
    this.commandCache.clear();
    this.commandReadyResolvers.clear();

    for (const unregister of this.unregisterCallbacks) {
      try { unregister(); } catch { /* ignore */ }
    }
    this.unregisterCallbacks.length = 0;
    await this.client.close();
  }

  async getHealth(): Promise<HealthInfo> {
    await this.ensureInitialized();
    return {
      healthy: true,
      version: `${this.config.version}-nexus-acp`,
    };
  }

  async getConfigProviders(): Promise<ConfigProviders> {
    await this.ensureInitialized();

    try {
      const cwd = this.config.agentCwd ?? this.config.projectDirs[0] ?? process.cwd();
      const discovery = await this.client.request<unknown>("session/new", {
        cwd,
        mcpServers: [],
      });
      const providers = extractConfigProvidersFromSession(discovery);
      if (providers) {
        return providers;
      }
    } catch {
      // Fall back to the synthetic catalog when the ACP agent does not advertise models.
    }

    return buildDefaultConfigProviders(this.config, "acp");
  }

  async listCommands(input: { project: Project }): Promise<Command[]> {
    await this.ensureInitialized();
    const acpSessionId = await this.resolveCommandDiscoverySession(input.project);
    if (!this.commandCache.has(acpSessionId)) {
      await this.waitForCommandAdvertisement(acpSessionId);
    }
    return this.commandCache.get(acpSessionId) ?? [];
  }

  async listTools(_input: { provider: string; model: string; project: Project }): Promise<ToolListItem[]> {
    return buildDefaultTools(this.config);
  }

  async getMcpStatus(_input: { project: Project }): Promise<Record<string, MCPStatus>> {
    return buildDefaultMcpStatus(this.config);
  }

  async listResources(input: { project: Project }): Promise<Record<string, McpResource>> {
    return buildDefaultResources(
      this.config,
      input.project,
      "Current project root exposed by the ACP bridge.",
    );
  }

  async *generateText(request: GenerateTextRequest): AsyncIterable<string> {
    await this.ensureInitialized();
    const acpSessionId = await this.resolveAcpSession(request);

    const queue = new AsyncQueue<string>();

    const unsubscribe = this.client.onSessionUpdate?.(acpSessionId, (body) => {
      const update = asRecord(body);
      if (!update) return;
      // Accept both `agent_message_chunk` (final response stream) AND
      // `agent_thought_chunk` (reasoning/plan stream). Agents differ in which
      // they use: Claude Code emits message_chunk, OpenCode emits its
      // workflow JSON via thought_chunk during the plan phase. Treating both
      // as text content surfaces visible streaming for every agent backend
      // without losing fidelity — the downstream JSON parser ignores
      // non-JSON prose anyway.
      if (
        update.sessionUpdate !== "agent_message_chunk" &&
        update.sessionUpdate !== "agent_thought_chunk"
      ) return;

      const content = asRecord(update.content);
      if (!content) return;

      if (content.type === "text") {
        const text = asString(content.text);
        if (text) queue.push(text);
      }
    }) ?? (() => {});

    const abortHandler = () => {
      void this.client.notify("session/cancel", { sessionId: acpSessionId }).catch(() => {});
    };
    if (request.signal.aborted) {
      abortHandler();
    } else {
      request.signal.addEventListener("abort", abortHandler, { once: true });
    }

    const promptPrompt = [
      ...(request.payload.system?.trim()
        ? [{
            type: "text" as const,
            text: `System instructions:\n${request.payload.system.trim()}`,
          }]
        : []),
      ...request.payload.parts
        .filter((part) => part.type === "text" && part.text.length > 0)
        .map((part) => ({ type: "text" as const, text: part.text })),
    ];

    const promptPromise = this.client.request<{ stopReason?: string }>("session/prompt", {
      sessionId: acpSessionId,
      prompt: promptPrompt,
    }).then(
      () => { queue.close(); },
      (error) => { queue.fail(error); },
    );

    try {
      for await (const chunk of queue) {
        if (request.signal.aborted) break;
        yield chunk;
      }
      await promptPromise;
    } finally {
      request.signal.removeEventListener("abort", abortHandler);
      unsubscribe();
    }
  }

  private ensureInitialized(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (this.initializePromise) return this.initializePromise;

    this.initializePromise = (async () => {
      await this.client.connect();
      await this.client.request<unknown>("initialize", {
        protocolVersion: this.config.acpProtocolVersion,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: false,
        },
        clientInfo: {
          name: "nexus-acp-bridge",
          version: this.config.version,
        },
      });
      this.initialized = true;
    })().catch((error) => {
      this.initializePromise = null;
      throw error;
    }).finally(() => {
      if (this.initialized) this.initializePromise = null;
    });

    return this.initializePromise;
  }

  private async resolveAcpSession(request: GenerateTextRequest): Promise<string> {
    const existing = this.sessionMap.get(request.session.id);
    if (existing) return existing;

    const result = await this.client.request<unknown>("session/new", {
      cwd: request.project.worktree,
      mcpServers: [],
    });

    const acpSessionId = asString(asRecord(result)?.sessionId);
    if (!acpSessionId) {
      throw new Error("ACP agent did not return a sessionId for session/new");
    }

    this.sessionMap.set(request.session.id, acpSessionId);
    return acpSessionId;
  }

  private async resolveCommandDiscoverySession(project: Project): Promise<string> {
    const existing = this.commandDiscoverySessionMap.get(project.worktree);
    if (existing) return existing;

    const result = await this.client.request<unknown>("session/new", {
      cwd: project.worktree,
      mcpServers: [],
    });

    const acpSessionId = asString(asRecord(result)?.sessionId);
    if (!acpSessionId) {
      throw new Error("ACP agent did not return a sessionId for session/new");
    }

    this.commandDiscoverySessionMap.set(project.worktree, acpSessionId);
    return acpSessionId;
  }

  private async waitForCommandAdvertisement(acpSessionId: string): Promise<void> {
    if (this.commandCache.has(acpSessionId)) return;

    await Promise.race([
      new Promise<void>((resolve) => {
        this.commandReadyResolvers.set(acpSessionId, resolve);
      }),
      sleep(250),
    ]);

    this.commandReadyResolvers.delete(acpSessionId);
  }

  private async handleReadTextFile(params: unknown): Promise<{ content: string }> {
    const record = asRecord(params);
    const requestedPath = asString(record?.path);
    if (!requestedPath) {
      throw new Error("fs/read_text_file requires an absolute path");
    }

    const absolutePath = this.requirePathInsideProject(requestedPath);

    const stat = await fs.stat(absolutePath);
    if (stat.size > this.config.maxFileReadBytes) {
      throw new Error(`File exceeds bridge size cap (${stat.size} > ${this.config.maxFileReadBytes})`);
    }

    const raw = await fs.readFile(absolutePath, "utf8");

    const line = typeof record?.line === "number" ? record.line : null;
    const limit = typeof record?.limit === "number" ? record.limit : null;

    if (line === null && limit === null) {
      return { content: raw };
    }

    const lines = raw.split(/\r?\n/);
    const startIndex = line && line > 0 ? line - 1 : 0;
    const endIndex = limit && limit > 0 ? Math.min(lines.length, startIndex + limit) : lines.length;
    return { content: lines.slice(startIndex, endIndex).join("\n") };
  }

  private async handleWriteTextFile(params: unknown): Promise<Record<string, never>> {
    const record = asRecord(params);
    const requestedPath = asString(record?.path);
    const content = typeof record?.content === "string" ? record.content : null;
    if (!requestedPath || content === null) {
      throw new Error("fs/write_text_file requires path and content");
    }

    const absolutePath = this.requirePathInsideProject(requestedPath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
    return {};
  }

  private async handleRequestPermission(params: unknown): Promise<{ outcome: unknown }> {
    const record = asRecord(params);
    const optionId = pickAllowOptionId(record?.options);
    if (optionId) {
      return { outcome: { outcome: "selected", optionId } };
    }
    return { outcome: { outcome: "cancelled" } };
  }

  private requirePathInsideProject(requestedPath: string): string {
    const absolute = path.isAbsolute(requestedPath) ? path.resolve(requestedPath) : path.resolve(requestedPath);
    for (const root of this.config.projectDirs) {
      const normalizedRoot = path.resolve(root);
      if (isPathInside(normalizedRoot, absolute)) return absolute;
    }
    throw new Error(`Path is outside of configured project roots: ${requestedPath}`);
  }
}



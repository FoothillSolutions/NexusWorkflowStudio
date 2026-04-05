import fs from "node:fs/promises";
import path from "node:path";
import type {
  ACPAdapter,
  AssistantMessage,
  BridgeConfig,
  FileContent,
  FileNode,
  FileStatus,
  MessageWithParts,
  OpenCodeEvent,
  Part,
  Project,
  PromptPayload,
  Session,
  SessionRecord,
  UserMessage,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "session";
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

function toErrorResponse(message: string, status = 400): Response {
  return json({ name: "BridgeError", data: { message } }, { status });
}

function getCorsHeaders(config: BridgeConfig): Record<string, string> {
  return {
    "access-control-allow-origin": config.corsOrigin,
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  };
}

function withCors(response: Response, config: BridgeConfig): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(getCorsHeaders(config))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function normalizePath(input: string): string {
  return path.resolve(input);
}

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

class EventBroker {
  private readonly subscribers = new Set<{
    directory: string | null;
    send: (event: OpenCodeEvent) => void;
    close: () => void;
  }>();

  subscribe(config: BridgeConfig, directory: string | null): Response {
    const stream = new TransformStream<string, string>();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    const heartbeat = setInterval(() => {
      void writer.write(": ping\n\n");
    }, 15_000);

    const send = (event: OpenCodeEvent) => {
      void writer.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const close = () => {
      clearInterval(heartbeat);
      void writer.close().catch(() => {});
      this.subscribers.delete(subscriber);
    };

    const subscriber = { directory, send, close };
    this.subscribers.add(subscriber);
    void writer.write(": connected\n\n");

    const readable = stream.readable.pipeThrough(new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(chunk));
      },
    }));

    return withCors(new Response(readable, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    }), config);
  }

  publish(event: OpenCodeEvent, directory: string): void {
    for (const subscriber of this.subscribers) {
      if (subscriber.directory && normalizePath(subscriber.directory) !== normalizePath(directory)) {
        continue;
      }
      subscriber.send(event);
    }
  }

  dispose(): void {
    for (const subscriber of this.subscribers) {
      subscriber.close();
    }
    this.subscribers.clear();
  }
}

export class NexusACPBridgeServer {
  private readonly eventBroker = new EventBroker();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly projectIds = new Map<string, string>();
  private server: Bun.Server<unknown> | null = null;

  constructor(
    private readonly config: BridgeConfig,
    private readonly adapter: ACPAdapter,
  ) {}

  start(): Bun.Server<unknown> {
    if (this.server) return this.server;

    this.server = Bun.serve({
      hostname: this.config.host,
      port: this.config.port,
      fetch: (request) => this.handleRequest(request),
    });

    return this.server;
  }

  stop(): void {
    this.server?.stop();
    this.server = null;
    this.eventBroker.dispose();
    void this.adapter.dispose?.();
  }

  private async handleRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), this.config);
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (request.method === "GET" && pathname === "/global/health") {
        return withCors(json(await this.adapter.getHealth()), this.config);
      }

      if (request.method === "GET" && pathname === "/config/providers") {
        return withCors(json(await this.adapter.getConfigProviders()), this.config);
      }

      if (request.method === "GET" && pathname === "/project") {
        return withCors(json(await this.listProjects()), this.config);
      }

      if (request.method === "GET" && pathname === "/project/current") {
        return withCors(json(await this.resolveProject(url.searchParams)), this.config);
      }

      if (request.method === "GET" && pathname === "/experimental/tool") {
        const project = await this.resolveProject(url.searchParams);
        const provider = url.searchParams.get("provider") ?? this.config.defaultProviderId;
        const model = url.searchParams.get("model") ?? this.config.defaultModelId;
        return withCors(json(await this.adapter.listTools({ provider, model, project })), this.config);
      }

      if (request.method === "GET" && pathname === "/experimental/tool/ids") {
        const project = await this.resolveProject(url.searchParams);
        const tools = await this.adapter.listTools({
          provider: this.config.defaultProviderId,
          model: this.config.defaultModelId,
          project,
        });
        return withCors(json(tools.map((tool) => tool.id)), this.config);
      }

      if (request.method === "GET" && pathname === "/mcp") {
        const project = await this.resolveProject(url.searchParams);
        return withCors(json(await this.adapter.getMcpStatus({ project })), this.config);
      }

      if (request.method === "GET" && pathname === "/experimental/resource") {
        const project = await this.resolveProject(url.searchParams);
        return withCors(json(await this.adapter.listResources({ project })), this.config);
      }

      if (request.method === "GET" && pathname === "/file") {
        const project = await this.resolveProject(url.searchParams);
        const entries = await this.listFiles(project, url.searchParams.get("path"));
        return withCors(json(entries), this.config);
      }

      if (request.method === "GET" && pathname === "/file/content") {
        const project = await this.resolveProject(url.searchParams);
        const content = await this.readFile(project, url.searchParams.get("path"));
        return withCors(json(content), this.config);
      }

      if (request.method === "GET" && pathname === "/file/status") {
        const status: FileStatus[] = [];
        return withCors(json(status), this.config);
      }

      if (request.method === "GET" && pathname === "/event") {
        const directory = url.searchParams.get("directory");
        return this.eventBroker.subscribe(this.config, directory);
      }

      if (request.method === "GET" && pathname === "/session") {
        return withCors(json([...this.sessions.values()].map((record) => record.session)), this.config);
      }

      if (request.method === "POST" && pathname === "/session") {
        const payload = await this.readJson<{ title?: string }>(request);
        const project = await this.resolveProject(new URL(request.url).searchParams);
        const session = this.createSession(project, payload?.title);
        return withCors(json(session), this.config);
      }

      const sessionMessageMatch = pathname.match(/^\/session\/([^/]+)\/message$/);
      if (request.method === "GET" && sessionMessageMatch) {
        const sessionId = decodeURIComponent(sessionMessageMatch[1] ?? "");
        const session = this.requireSession(sessionId);
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Number(limitRaw) : undefined;
        const messages = Number.isFinite(limit)
          ? session.messages.slice(-Math.max(0, limit ?? 0))
          : session.messages;
        return withCors(json(messages), this.config);
      }

      if (request.method === "POST" && sessionMessageMatch) {
        const sessionId = decodeURIComponent(sessionMessageMatch[1] ?? "");
        const payload = await this.readJson<PromptPayload>(request);
        const message = await this.runPromptAsync(sessionId, payload);
        return withCors(json(message), this.config);
      }

      const promptAsyncMatch = pathname.match(/^\/session\/([^/]+)\/prompt_async$/);
      if (request.method === "POST" && promptAsyncMatch) {
        const sessionId = decodeURIComponent(promptAsyncMatch[1] ?? "");
        const payload = await this.readJson<PromptPayload>(request);
        this.requireSession(sessionId);
        void this.runPromptAsync(sessionId, payload);
        return withCors(json(true), this.config);
      }

      const sessionAbortMatch = pathname.match(/^\/session\/([^/]+)\/abort$/);
      if (request.method === "POST" && sessionAbortMatch) {
        const sessionId = decodeURIComponent(sessionAbortMatch[1] ?? "");
        const session = this.requireSession(sessionId);
        session.abortController?.abort();
        session.abortController = null;
        session.status = "idle";
        this.eventBroker.publish({ type: "session.idle", properties: { sessionID: sessionId } }, session.session.directory);
        return withCors(json(true), this.config);
      }

      const sessionDeleteMatch = pathname.match(/^\/session\/([^/]+)$/);
      if (request.method === "DELETE" && sessionDeleteMatch) {
        const sessionId = decodeURIComponent(sessionDeleteMatch[1] ?? "");
        const session = this.requireSession(sessionId);
        session.abortController?.abort();
        this.sessions.delete(sessionId);
        return withCors(json(true), this.config);
      }

      return withCors(toErrorResponse(`Unsupported route: ${request.method} ${pathname}`, 404), this.config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown bridge error";
      const status = error instanceof HttpBridgeError ? error.status : 500;
      return withCors(toErrorResponse(message, status), this.config);
    }
  }

  private async readJson<T>(request: Request): Promise<T> {
    const text = await request.text();
    if (!text.trim()) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  }

  private async listProjects(): Promise<Project[]> {
    const results: Project[] = [];
    for (const dir of this.config.projectDirs) {
      try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) continue;
        results.push(this.toProject(dir));
      } catch {
        // Ignore missing directories.
      }
    }
    return results;
  }

  private async resolveProject(searchParams: URLSearchParams): Promise<Project> {
    const requestedDirectory = searchParams.get("directory")?.trim();
    if (!requestedDirectory) {
      return this.toProject(this.config.projectDirs[0] ?? process.cwd());
    }

    const normalized = normalizePath(requestedDirectory);
    const knownProject = this.config.projectDirs.find((dir) => normalizePath(dir) === normalized);
    if (knownProject) {
      return this.toProject(knownProject);
    }

    if (!this.config.allowArbitraryDirectories) {
      throw new HttpBridgeError(404, `Unknown project directory: ${requestedDirectory}`);
    }

    const stat = await fs.stat(normalized).catch(() => null);
    if (!stat?.isDirectory()) {
      throw new HttpBridgeError(404, `Project directory not found: ${requestedDirectory}`);
    }

    return this.toProject(normalized);
  }

  private toProject(directory: string): Project {
    const normalized = normalizePath(directory);
    const existingId = this.projectIds.get(normalized);
    const id = existingId ?? `project_${slugify(path.basename(normalized) || "root")}`;
    this.projectIds.set(normalized, id);
    const now = Date.now();

    return {
      id,
      worktree: normalized,
      vcs: "git",
      name: path.basename(normalized) || normalized,
      time: {
        created: now,
        updated: now,
      },
      sandboxes: [],
    };
  }

  private async listFiles(project: Project, requestedPath: string | null): Promise<FileNode[]> {
    const absolutePath = await this.resolveFilePath(project, requestedPath);
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    return entries
      .filter((entry) => !entry.name.startsWith("."))
      .sort((left, right) => {
        if (left.isDirectory() === right.isDirectory()) {
          return left.name.localeCompare(right.name);
        }
        return left.isDirectory() ? -1 : 1;
      })
      .map((entry) => {
        const absolute = path.join(absolutePath, entry.name);
        return {
          name: entry.name,
          path: absolute,
          absolute,
          type: entry.isDirectory() ? "directory" : "file",
          ignored: false,
        } satisfies FileNode;
      });
  }

  private async readFile(project: Project, requestedPath: string | null): Promise<FileContent> {
    const absolutePath = await this.resolveFilePath(project, requestedPath);
    const buffer = await fs.readFile(absolutePath);
    const content = buffer.toString("utf8");
    return {
      type: "text",
      content,
      mimeType: "text/plain",
    };
  }

  private async resolveFilePath(project: Project, requestedPath: string | null): Promise<string> {
    const root = normalizePath(project.worktree);
    const candidate = !requestedPath || requestedPath === "."
      ? root
      : path.isAbsolute(requestedPath)
        ? normalizePath(requestedPath)
        : normalizePath(path.join(root, requestedPath));

    if (!isPathInside(root, candidate)) {
      throw new HttpBridgeError(400, `Path is outside project root: ${requestedPath}`);
    }

    const stat = await fs.stat(candidate).catch(() => null);
    if (!stat) {
      throw new HttpBridgeError(404, `Path not found: ${requestedPath}`);
    }

    return candidate;
  }

  private createSession(project: Project, title?: string): Session {
    const session: Session = {
      id: createId("session"),
      slug: slugify(title ?? project.name ?? "nexus-session"),
      projectID: project.id,
      directory: project.worktree,
      title: title?.trim() || "Nexus ACP Session",
      version: this.config.version,
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    };

    this.sessions.set(session.id, {
      session,
      project,
      messages: [],
      abortController: null,
      status: "idle",
    });

    return session;
  }

  private requireSession(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new HttpBridgeError(404, `Session not found: ${sessionId}`);
    }
    return session;
  }

  private async runPromptAsync(sessionId: string, payload: PromptPayload): Promise<MessageWithParts> {
    const record = this.requireSession(sessionId);
    record.abortController?.abort();
    const abortController = new AbortController();
    record.abortController = abortController;
    record.status = "busy";
    record.session.time.updated = Date.now();

    const userMessageId = createId("msg");
    const assistantMessageId = createId("msg");
    const textPartId = createId("part");
    const now = Date.now();
    const promptText = payload.parts.map((part) => part.text).join("\n\n");

    const userInfo: UserMessage = {
        id: userMessageId,
        sessionID: sessionId,
        role: "user",
        time: { created: now },
        model: payload.model,
        system: payload.system,
        tools: payload.tools,
    };

    const userMessage: MessageWithParts = {
      info: userInfo,
      parts: payload.parts.map((part) => ({
        id: part.id ?? createId("part"),
        sessionID: sessionId,
        messageID: userMessageId,
        type: "text",
        text: part.text,
      })),
    };

    const assistantParts: Part[] = [{
      id: textPartId,
      sessionID: sessionId,
      messageID: assistantMessageId,
      type: "text",
      text: "",
    }];

    const assistantInfo: AssistantMessage = {
        id: assistantMessageId,
        sessionID: sessionId,
        role: "assistant",
        time: { created: now },
        parentID: userMessageId,
        modelID: payload.model?.modelID ?? this.config.defaultModelId,
        providerID: payload.model?.providerID ?? this.config.defaultProviderId,
        mode: "chat",
        agent: payload.agent ?? "acp-bridge",
        path: { cwd: record.project.worktree, root: record.project.worktree },
        cost: 0,
        tokens: {
          input: Math.ceil(promptText.length / 4),
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
    };

    const assistantMessage: MessageWithParts = {
      info: assistantInfo,
      parts: assistantParts,
    };

    record.messages.push(userMessage, assistantMessage);

    this.eventBroker.publish({ type: "message.updated", properties: { info: userInfo } }, record.session.directory);
    this.eventBroker.publish({ type: "message.updated", properties: { info: assistantInfo } }, record.session.directory);
    this.eventBroker.publish({ type: "session.updated", properties: { info: record.session } }, record.session.directory);

    try {
      for await (const delta of this.adapter.generateText({
        session: record.session,
        project: record.project,
        payload,
        signal: abortController.signal,
      })) {
        if (abortController.signal.aborted) {
          break;
        }

        const textPart = assistantParts[0];
        textPart.text += delta;
        assistantInfo.tokens.output += Math.ceil(delta.length / 4);

        this.eventBroker.publish({
          type: "message.part.delta",
          properties: {
            sessionID: sessionId,
            messageID: assistantMessageId,
            partID: textPartId,
            field: "text",
            delta,
          },
        }, record.session.directory);
      }

      assistantInfo.time.completed = Date.now();
      assistantInfo.finish = abortController.signal.aborted ? "abort" : "stop";
      record.status = "idle";
      record.abortController = null;
      record.session.time.updated = Date.now();
      this.eventBroker.publish({ type: "session.updated", properties: { info: record.session } }, record.session.directory);
      this.eventBroker.publish({ type: "session.idle", properties: { sessionID: sessionId } }, record.session.directory);
      return assistantMessage;
    } catch (error) {
      record.status = "idle";
      record.abortController = null;
      assistantInfo.error = {
        name: "UnknownError",
        data: { message: error instanceof Error ? error.message : "Bridge generation failed" },
      };
      assistantInfo.time.completed = Date.now();
      this.eventBroker.publish({
        type: "session.error",
        properties: {
          sessionID: sessionId,
          error: assistantInfo.error,
        },
      }, record.session.directory);
      return assistantMessage;
    }
  }
}

class HttpBridgeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpBridgeError";
  }
}




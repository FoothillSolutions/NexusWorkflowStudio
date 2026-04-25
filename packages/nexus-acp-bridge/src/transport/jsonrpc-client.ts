import {
  JsonRpcError,
  isJsonRpcFailure,
  isJsonRpcNotification,
  type JsonRpcFailure,
  type JsonRpcMessage,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcSuccess,
} from "./jsonrpc";
import { ACPStdioTransport } from "./stdio-transport";
import type { BridgeConfig } from "../types";

export type ACPSessionUpdateHandler = (update: unknown, raw: JsonRpcNotification) => void;

export type ACPRequestHandler = (params: unknown) => Promise<unknown> | unknown;

export interface ACPJsonRpcClientLike {
  connect(): Promise<void>;
  close(): Promise<void>;
  request<T>(method: string, params?: unknown): Promise<T>;
  notify(method: string, params?: unknown): Promise<void>;
  onNotification(listener: (notification: JsonRpcNotification) => void): () => void;
  onSessionUpdate?(sessionId: string, handler: ACPSessionUpdateHandler): () => void;
  setRequestHandler?(method: string, handler: ACPRequestHandler): () => void;
}

const SESSION_UPDATE_METHOD = "session/update";

function extractUpdateSessionId(params: unknown): string | null {
  if (typeof params !== "object" || params === null) return null;
  const candidate = (params as { sessionId?: unknown }).sessionId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function extractUpdateBody(params: unknown): unknown {
  if (typeof params !== "object" || params === null) return null;
  return (params as { update?: unknown }).update ?? null;
}

export class ACPJsonRpcClient implements ACPJsonRpcClientLike {
  private readonly transport: ACPStdioTransport;
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }>();
  private readonly notificationListeners = new Set<(notification: JsonRpcNotification) => void>();
  private readonly sessionUpdateListeners = new Map<string, Set<ACPSessionUpdateHandler>>();
  private readonly requestHandlers = new Map<string, ACPRequestHandler>();
  private nextId = 1;
  private connectStarted = false;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly config: BridgeConfig) {
    this.transport = new ACPStdioTransport(config, config.acpProtocol);
    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.onClose((error) => this.handleClose(error));
  }

  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.transport.connect();
    return this.connectPromise;
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    await this.connect();
    const id = this.nextId++;

    const response = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    });

    try {
      await this.transport.send({
        jsonrpc: "2.0",
        id,
        method,
        params,
      });
    } catch (error) {
      this.pending.delete(id);
      throw error;
    }

    return response;
  }

  async notify(method: string, params?: unknown): Promise<void> {
    await this.connect();
    await this.transport.send({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  onNotification(listener: (notification: JsonRpcNotification) => void): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  onSessionUpdate(sessionId: string, handler: ACPSessionUpdateHandler): () => void {
    let handlers = this.sessionUpdateListeners.get(sessionId);
    if (!handlers) {
      handlers = new Set();
      this.sessionUpdateListeners.set(sessionId, handlers);
    }
    handlers.add(handler);
    return () => {
      const set = this.sessionUpdateListeners.get(sessionId);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) this.sessionUpdateListeners.delete(sessionId);
    };
  }

  setRequestHandler(method: string, handler: ACPRequestHandler): () => void {
    this.requestHandlers.set(method, handler);
    return () => {
      const current = this.requestHandlers.get(method);
      if (current === handler) this.requestHandlers.delete(method);
    };
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (isJsonRpcNotification(message)) {
      this.dispatchNotification(message);
      return;
    }

    if (isJsonRpcFailure(message)) {
      if (message.id !== null && typeof message.id === "number") {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        pending?.reject(new JsonRpcError(message.error.message, message.error.code, message.error.data));
      }
      return;
    }

    if ("result" in message) {
      const response = message as JsonRpcSuccess;
      const pending = this.pending.get(response.id);
      this.pending.delete(response.id);
      pending?.resolve(response.result);
      return;
    }

    if ("method" in message && "id" in message) {
      void this.dispatchInboundRequest(message as JsonRpcRequest);
    }
  }

  private dispatchNotification(notification: JsonRpcNotification): void {
    for (const listener of this.notificationListeners) {
      listener(notification);
    }

    if (notification.method !== SESSION_UPDATE_METHOD) return;

    const sessionId = extractUpdateSessionId(notification.params);
    if (!sessionId) return;

    const handlers = this.sessionUpdateListeners.get(sessionId);
    if (!handlers) return;

    const body = extractUpdateBody(notification.params);
    for (const handler of handlers) {
      try {
        handler(body, notification);
      } catch {
        // Handler errors must not break the transport; swallow and continue.
      }
    }
  }

  private async dispatchInboundRequest(request: JsonRpcRequest): Promise<void> {
    const handler = this.requestHandlers.get(request.method);
    if (!handler) {
      await this.sendFailure(request.id, {
        code: -32601,
        message: `Method not found: ${request.method}`,
      });
      return;
    }

    try {
      const result = await handler(request.params);
      await this.transport.send({
        jsonrpc: "2.0",
        id: request.id,
        result: result ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request handler failed";
      await this.sendFailure(request.id, { code: -32000, message });
    }
  }

  private async sendFailure(id: number, error: JsonRpcFailure["error"]): Promise<void> {
    try {
      await this.transport.send({
        jsonrpc: "2.0",
        id,
        error,
      });
    } catch {
      // Transport already closed — nothing we can do.
    }
  }

  private handleClose(error?: Error): void {
    this.connectPromise = null;
    this.connectStarted = false;

    for (const [id, pending] of this.pending.entries()) {
      pending.reject(error ?? new Error(`ACP transport closed while waiting for response ${id}`));
    }
    this.pending.clear();
    this.sessionUpdateListeners.clear();
  }
}

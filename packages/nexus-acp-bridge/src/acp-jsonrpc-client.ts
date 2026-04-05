import {
  JsonRpcError,
  isJsonRpcFailure,
  isJsonRpcNotification,
  type JsonRpcMessage,
  type JsonRpcNotification,
  type JsonRpcSuccess,
} from "./acp-jsonrpc";
import { ACPStdioTransport } from "./acp-stdio-transport";
import type { BridgeConfig } from "./types";

export interface ACPJsonRpcClientLike {
  connect(): Promise<void>;
  close(): Promise<void>;
  request<T>(method: string, params?: unknown): Promise<T>;
  notify(method: string, params?: unknown): Promise<void>;
  onNotification(listener: (notification: JsonRpcNotification) => void): () => void;
}

export class ACPJsonRpcClient implements ACPJsonRpcClientLike {
  private readonly transport: ACPStdioTransport;
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }>();
  private readonly notificationListeners = new Set<(notification: JsonRpcNotification) => void>();
  private nextId = 1;
  private initialized = false;
  private initializePromise: Promise<void> | null = null;

  constructor(private readonly config: BridgeConfig) {
    this.transport = new ACPStdioTransport(config, config.acpProtocol);
    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.onClose((error) => this.handleClose(error));
  }

  async connect(): Promise<void> {
    await this.transport.connect();
    await this.initialize();
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

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.config.acpMethods.initialize) {
      this.initialized = true;
      return;
    }
    if (this.initializePromise) return this.initializePromise;

    this.initializePromise = this.request<unknown>(this.config.acpMethods.initialize, {
      client: {
        name: "nexus-acp-bridge",
        version: this.config.version,
      },
    }).then(() => {
      this.initialized = true;
    }).finally(() => {
      this.initializePromise = null;
    });

    return this.initializePromise;
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (isJsonRpcNotification(message)) {
      for (const listener of this.notificationListeners) {
        listener(message);
      }
      return;
    }

    if (isJsonRpcFailure(message)) {
      if (message.id !== null) {
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
    }
  }

  private handleClose(error?: Error): void {
    this.initialized = false;
    this.initializePromise = null;

    for (const [id, pending] of this.pending.entries()) {
      pending.reject(error ?? new Error(`ACP transport closed while waiting for response ${id}`));
    }
    this.pending.clear();
  }
}



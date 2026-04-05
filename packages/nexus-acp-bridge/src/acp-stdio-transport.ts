import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { decodeJsonRpcMessages, encodeJsonRpcMessage, type JsonRpcMessage } from "./acp-jsonrpc";
import type { ACPTransportProtocol, BridgeConfig } from "./types";

export class ACPStdioTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = Buffer.alloc(0);
  private readonly messageListeners = new Set<(message: JsonRpcMessage) => void>();
  private readonly closeListeners = new Set<(error?: Error) => void>();
  private connectPromise: Promise<void> | null = null;
  private stderrChunks: string[] = [];

  constructor(
    private readonly config: BridgeConfig,
    private readonly protocol: ACPTransportProtocol,
  ) {}

  async connect(): Promise<void> {
    if (this.child && !this.child.killed) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      if (!this.config.agentCommand) {
        reject(new Error("NEXUS_ACP_BRIDGE_AGENT_COMMAND is required when NEXUS_ACP_BRIDGE_ADAPTER=acp"));
        return;
      }

      const child = spawn(this.config.agentCommand, this.config.agentArgs, {
        cwd: this.config.agentCwd ?? this.config.projectDirs[0] ?? process.cwd(),
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.child = child;
      this.stderrChunks = [];

      child.once("spawn", () => resolve());
      child.once("error", (error) => {
        this.child = null;
        reject(error);
      });
      child.stdout.on("data", (chunk: Buffer) => {
        this.handleStdoutChunk(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        this.stderrChunks.push(chunk.toString("utf8"));
      });
      child.once("close", (code, signal) => {
        const stderr = this.stderrChunks.join("").trim();
        const error = code === 0 || code === null
          ? undefined
          : new Error(stderr || `ACP process exited with code ${code}${signal ? ` (${signal})` : ""}`);
        this.child = null;
        this.connectPromise = null;
        this.buffer = Buffer.alloc(0);
        for (const listener of this.closeListeners) {
          listener(error);
        }
      });
    });

    try {
      await this.connectPromise;
    } finally {
      if (!this.child) {
        this.connectPromise = null;
      }
    }
  }

  async send(message: JsonRpcMessage): Promise<void> {
    await this.connect();
    const child = this.child;
    if (!child) {
      throw new Error("ACP stdio transport is not connected");
    }

    const payload = encodeJsonRpcMessage(message, this.protocol);
    await new Promise<void>((resolve, reject) => {
      child.stdin.write(payload, (error) => {
        if (error) reject(error); else resolve();
      });
    });
  }

  onMessage(listener: (message: JsonRpcMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onClose(listener: (error?: Error) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  async close(): Promise<void> {
    const child = this.child;
    if (!child) return;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 250);

      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });

      child.stdin.end();
      child.kill("SIGTERM");
    });
  }

  private handleStdoutChunk(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const { messages, remainder } = decodeJsonRpcMessages(this.buffer, this.protocol);
    this.buffer = Buffer.from(remainder);

    for (const message of messages) {
      for (const listener of this.messageListeners) {
        listener(message);
      }
    }
  }
}



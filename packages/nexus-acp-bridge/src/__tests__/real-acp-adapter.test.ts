import { describe, expect, test } from "bun:test";
import type { ACPJsonRpcClientLike } from "../acp-jsonrpc-client";
import { RealACPAdapter } from "../real-acp-adapter";
import { makeBridgeConfig, makeGenerateTextRequest } from "./test-helpers";

class FakeJsonRpcClient implements ACPJsonRpcClientLike {
  private readonly listeners = new Set<(notification: { jsonrpc: "2.0"; method: string; params?: unknown }) => void>();

  async connect(): Promise<void> {}
  async close(): Promise<void> {}

  async request<T>(method: string, params?: unknown): Promise<T> {
    if (method === "initialize") {
      return { version: "acp-test-1.0.0" } as T;
    }
    if (method === "health") {
      return { version: "acp-health-1.0.0" } as T;
    }
    if (method === "models/list") {
      return { models: [{ id: "demo", name: "Demo Model" }] } as T;
    }
    if (method === "tools/list") {
      return { tools: [{ id: "read_file", description: "Read a file", parameters: { type: "object", properties: {} } }] } as T;
    }
    if (method === "resources/list") {
      return { project: { name: "Root", uri: "file:///tmp/demo", client: "acp" } } as T;
    }
    if (method === "mcp/status") {
      return { acp: { status: "connected" } } as T;
    }
    if (method === "message/send") {
      const requestId = (params as { metadata?: { requestId?: string } })?.metadata?.requestId;
      queueMicrotask(() => {
        for (const listener of this.listeners) {
          listener({ jsonrpc: "2.0", method: "message/delta", params: { requestId, delta: "hello " } });
          listener({ jsonrpc: "2.0", method: "message/delta", params: { requestId, delta: "world" } });
          listener({ jsonrpc: "2.0", method: "message/completed", params: { requestId } });
        }
      });
      return { streamId: requestId } as T;
    }
    return {} as T;
  }

  async notify(): Promise<void> {}

  onNotification(listener: (notification: { jsonrpc: "2.0"; method: string; params?: unknown }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

describe("RealACPAdapter", () => {
  test("maps JSON-RPC ACP responses into bridge-facing APIs", async () => {
    const adapter = new RealACPAdapter(makeBridgeConfig({
      adapterMode: "acp",
      acpProtocol: "newline",
    }), new FakeJsonRpcClient());

    try {
      const health = await adapter.getHealth();
      const providers = await adapter.getConfigProviders();
      const request = makeGenerateTextRequest();
      const tools = await adapter.listTools({
        provider: "acp",
        model: "demo",
        project: request.project,
      });
      const resources = await adapter.listResources({ project: request.project });
      const mcp = await adapter.getMcpStatus({ project: request.project });

      let output = "";
      for await (const chunk of adapter.generateText(request)) {
        output += chunk;
      }

      expect(health.version).toBe("acp-health-1.0.0");
      expect(providers.providers[0]?.models.demo?.name).toBe("Demo Model");
      expect(tools[0]?.id).toBe("read_file");
      expect(resources.project?.uri).toBe("file:///tmp/demo");
      expect(mcp.acp?.status).toBe("connected");
      expect(output).toBe("hello world");
    } finally {
      await adapter.dispose();
    }
  });
});



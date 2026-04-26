import { describe, expect, test } from "bun:test";
import type { JsonRpcNotification } from "../transport/jsonrpc";
import type {
  ACPJsonRpcClientLike,
  ACPRequestHandler,
  ACPSessionUpdateHandler,
} from "../transport/jsonrpc-client";
import type { OpenCodeEvent } from "../types";
import { ACPProtocolAdapter } from "../adapters/acp-protocol";
import { makeBridgeConfig, makeGenerateTextRequest } from "./test-helpers";

interface Recorded {
  method: string;
  params: unknown;
}

class FakeACPClient implements ACPJsonRpcClientLike {
  readonly requestsSent: Recorded[] = [];
  readonly notifications: Recorded[] = [];
  private readonly notificationListeners = new Set<(notification: JsonRpcNotification) => void>();
  private readonly sessionHandlers = new Map<string, Set<ACPSessionUpdateHandler>>();
  private readonly requestHandlers = new Map<string, ACPRequestHandler>();
  private nextAcpSessionId = 1;
  sessionNewResult: unknown = null;
  promptUpdates: unknown[] = [];
  promptHook: ((sessionId: string) => Promise<void>) | null = null;

  requestHandler: ((method: string, params: unknown) => Promise<unknown>) | null = null;

  async connect(): Promise<void> {}
  async close(): Promise<void> {}

  async request<T>(method: string, params?: unknown): Promise<T> {
    this.requestsSent.push({ method, params });

    if (method === "initialize") {
      return { protocolVersion: 1, agentCapabilities: {} } as T;
    }

    if (method === "session/new") {
      if (this.sessionNewResult) {
        return this.sessionNewResult as T;
      }
      const sessionId = `acp-session-${this.nextAcpSessionId++}`;
      queueMicrotask(() => this.emitSessionUpdate(sessionId, {
        sessionUpdate: "available_commands_update",
        availableCommands: [
          {
            name: "plan",
            description: "Create a detailed implementation plan",
            input: { hint: "what to plan" },
          },
        ],
      }));
      return { sessionId } as T;
    }

    if (method === "session/prompt") {
      const sessionId = (params as { sessionId?: string })?.sessionId;
      if (sessionId) {
        for (const update of this.promptUpdates) {
          queueMicrotask(() => this.emitSessionUpdate(sessionId, update));
        }
        queueMicrotask(() => this.emitSessionUpdate(sessionId, {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "hello " },
        }));
        queueMicrotask(() => this.emitSessionUpdate(sessionId, {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "world" },
        }));
        await this.promptHook?.(sessionId);
      }
      return { stopReason: "end_turn" } as T;
    }

    if (this.requestHandler) {
      return await this.requestHandler(method, params) as T;
    }

    return {} as T;
  }

  async notify(method: string, params?: unknown): Promise<void> {
    this.notifications.push({ method, params });
  }

  onNotification(listener: (notification: JsonRpcNotification) => void): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  onSessionUpdate(sessionId: string, handler: ACPSessionUpdateHandler): () => void {
    let set = this.sessionHandlers.get(sessionId);
    if (!set) {
      set = new Set();
      this.sessionHandlers.set(sessionId, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  setRequestHandler(method: string, handler: ACPRequestHandler): () => void {
    this.requestHandlers.set(method, handler);
    return () => {
      const current = this.requestHandlers.get(method);
      if (current === handler) this.requestHandlers.delete(method);
    };
  }

  async invokeRequestHandler(method: string, params: unknown): Promise<unknown> {
    const handler = this.requestHandlers.get(method);
    if (!handler) throw new Error(`No handler registered for ${method}`);
    return await handler(params);
  }

  emitSessionUpdate(sessionId: string, update: unknown): void {
    const notification = { jsonrpc: "2.0", method: "session/update", params: { sessionId, update } } as const;
    for (const listener of this.notificationListeners) {
      listener(notification);
    }

    const set = this.sessionHandlers.get(sessionId);
    if (!set) return;
    for (const handler of set) {
      handler(update, notification);
    }
  }
}

describe("ACPProtocolAdapter", () => {
  test("negotiates initialize and streams agent_message_chunk updates", async () => {
    const client = new FakeACPClient();
    const adapter = new ACPProtocolAdapter(
      makeBridgeConfig({ adapterMode: "acp", acpProtocol: "newline" }),
      client,
    );

    try {
      const health = await adapter.getHealth();
      expect(health.version).toMatch(/-acp$/);

      const request = makeGenerateTextRequest();
      let output = "";
      for await (const chunk of adapter.generateText(request)) {
        output += chunk;
      }

      expect(output).toBe("hello world");

      const methods = client.requestsSent.map((r) => r.method);
      expect(methods).toContain("initialize");
      expect(methods).toContain("session/new");
      expect(methods).toContain("session/prompt");

      const initCall = client.requestsSent.find((r) => r.method === "initialize");
      expect((initCall?.params as { protocolVersion?: number })?.protocolVersion).toBe(1);
      expect((initCall?.params as { clientCapabilities?: { fs?: { readTextFile?: boolean } } })?.clientCapabilities?.fs?.readTextFile).toBe(true);

      const promptCall = client.requestsSent.find((r) => r.method === "session/prompt");
      expect((promptCall?.params as { prompt?: unknown[] })?.prompt).toEqual([
        { type: "text", text: "System instructions:\nsystem prompt" },
        { type: "text", text: "hello from nexus" },
      ]);
    } finally {
      await adapter.dispose();
    }
  });

  test("discovers real ACP model catalogs from session/new when available", async () => {
    const client = new FakeACPClient();
    client.sessionNewResult = {
      sessionId: "acp-session-config",
      models: {
        currentModelId: "github-copilot/claude-sonnet-4.6",
        availableModels: [
          { modelId: "github-copilot/claude-sonnet-4.6", name: "GitHub Copilot/Claude Sonnet 4.6" },
          { modelId: "github-copilot/claude-sonnet-4.6/low", name: "GitHub Copilot/Claude Sonnet 4.6 (low)" },
          { modelId: "opencode/big-pickle", name: "OpenCode Zen/Big Pickle" },
        ],
      },
    };

    const adapter = new ACPProtocolAdapter(
      makeBridgeConfig({
        adapterMode: "acp",
        selectedTool: "opencode",
        defaultProviderId: "opencode",
        defaultProviderName: "OpenCode",
        defaultModelId: "default",
      }),
      client,
    );

    try {
      const providers = await adapter.getConfigProviders();

      expect(providers.default).toEqual({
        "github-copilot": "claude-sonnet-4.6",
        opencode: "big-pickle",
      });
      expect(providers.providers.map((provider) => provider.id)).toEqual([
        "github-copilot",
        "opencode",
      ]);
      expect(providers.providers[0]?.name).toBe("GitHub Copilot");
      expect(providers.providers[0]?.models["claude-sonnet-4.6"]?.name).toBe("Claude Sonnet 4.6");
      expect(providers.providers[0]?.models["claude-sonnet-4.6/low"]?.family).toBe("claude-sonnet-4.6");
      expect(providers.providers[1]?.name).toBe("OpenCode Zen");
      expect(providers.providers[1]?.models["big-pickle"]?.name).toBe("Big Pickle");
    } finally {
      await adapter.dispose();
    }
  });

  test("reuses ACP session across prompts on the same bridge session", async () => {
    const client = new FakeACPClient();
    const adapter = new ACPProtocolAdapter(
      makeBridgeConfig({ adapterMode: "acp", acpProtocol: "newline" }),
      client,
    );

    try {
      const request = makeGenerateTextRequest();
      for await (const _ of adapter.generateText(request)) { /* drain */ }
      for await (const _ of adapter.generateText(request)) { /* drain */ }

      const newCalls = client.requestsSent.filter((r) => r.method === "session/new");
      expect(newCalls).toHaveLength(1);
    } finally {
      await adapter.dispose();
    }
  });

  test("caches ACP available commands for project discovery", async () => {
    const client = new FakeACPClient();
    const adapter = new ACPProtocolAdapter(
      makeBridgeConfig({ adapterMode: "acp", acpProtocol: "newline" }),
      client,
    );

    try {
      const request = makeGenerateTextRequest();
      const commands = await adapter.listCommands({ project: request.project });

      expect(commands).toEqual([
        {
          name: "plan",
          description: "Create a detailed implementation plan",
          source: "command",
          template: "/plan {what to plan}",
          hints: ["what to plan"],
        },
      ]);
    } finally {
      await adapter.dispose();
    }
  });

  test("sends session/cancel notification on abort", async () => {
    const client = new FakeACPClient();
    const adapter = new ACPProtocolAdapter(
      makeBridgeConfig({ adapterMode: "acp", acpProtocol: "newline" }),
      client,
    );

    try {
      const controller = new AbortController();
      const request = { ...makeGenerateTextRequest(), signal: controller.signal };
      controller.abort();
      for await (const _ of adapter.generateText(request)) { /* no-op */ }

      const cancelCall = client.notifications.find((n) => n.method === "session/cancel");
      expect(cancelCall).toBeDefined();
    } finally {
      await adapter.dispose();
    }
  });

  test("emits tool call events with bridge session and assistant message IDs", async () => {
    const client = new FakeACPClient();
    client.promptUpdates = [
      {
        sessionUpdate: "tool_call",
        toolCall: { callId: "call-1", title: "Read file", kind: "read", input: { path: "README.md" } },
        status: "running",
      },
      {
        sessionUpdate: "tool_call_update",
        toolCall: { callId: "call-1", title: "Read file", kind: "read", output: { lines: 3 } },
        status: "completed",
      },
    ];
    const adapter = new ACPProtocolAdapter(makeBridgeConfig({ adapterMode: "acp" }), client);
    const events: unknown[] = [];

    try {
      const request = {
        ...makeGenerateTextRequest(),
        assistantMessageID: "assistant-123",
        publishEvent: (event: unknown) => events.push(event),
      };
      for await (const _ of adapter.generateText(request)) { /* drain */ }

      expect(events).toContainEqual({
        type: "tool.call",
        properties: {
          sessionID: "session-1",
          messageID: "assistant-123",
          callID: "call-1",
          title: "Read file",
          kind: "read",
          rawInput: { path: "README.md" },
          status: "running",
        },
      });
      expect(events).toContainEqual({
        type: "tool.call.updated",
        properties: {
          sessionID: "session-1",
          messageID: "assistant-123",
          callID: "call-1",
          title: "Read file",
          kind: "read",
          status: "completed",
          rawOutput: { lines: 3 },
        },
      });
    } finally {
      await adapter.dispose();
    }
  });

  test("registers fs/read_text_file and keeps auto permission approval by default", async () => {
    const client = new FakeACPClient();
    const adapter = new ACPProtocolAdapter(
      makeBridgeConfig({ adapterMode: "acp", projectDirs: [process.cwd()] }),
      client,
    );

    try {
      const permissionResult = await client.invokeRequestHandler("session/request_permission", {
        sessionId: "x",
        toolCall: {},
        options: [
          { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
          { optionId: "reject_once", name: "Reject", kind: "reject_once" },
        ],
      });
      expect(permissionResult).toEqual({ outcome: { outcome: "selected", optionId: "allow_once" } });

      const readResult = await client.invokeRequestHandler("fs/read_text_file", {
        sessionId: "x",
        path: `${process.cwd()}/package.json`,
      });
      expect(typeof (readResult as { content?: unknown }).content).toBe("string");
    } finally {
      await adapter.dispose();
    }
  });

  test("forwards permission requests and resolves selected/cancelled responses", async () => {
    const client = new FakeACPClient();
    const adapter = new ACPProtocolAdapter(
      makeBridgeConfig({ adapterMode: "acp", permissionTimeoutMs: 1_000 }),
      client,
    );
    const events: OpenCodeEvent[] = [];

    client.promptHook = async (sessionId) => {
      const pending = client.invokeRequestHandler("session/request_permission", {
        sessionId,
        toolCall: { title: "Write file", kind: "write" },
        options: [{ optionId: "allow_once", name: "Allow once", kind: "allow_once" }],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const requestID = events.find((event) => event.type === "permission.requested")?.properties?.requestID;
      expect(requestID).toBeString();
      const resolved = await adapter.respondToPermission({
        sessionID: "session-1",
        requestID: requestID as string,
        outcome: { outcome: "selected", optionId: "allow_once" },
      });
      expect(resolved).toBe(true);
      expect(await pending).toEqual({ outcome: { outcome: "selected", optionId: "allow_once" } });

      const cancelPending = client.invokeRequestHandler("session/request_permission", {
        sessionId,
        toolCall: { title: "Run command" },
        options: [{ optionId: "reject_once", name: "Reject", kind: "reject_once" }],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const cancelID = events.filter((event) => event.type === "permission.requested").at(-1)?.properties.requestID;
      expect(cancelID).toBeString();
      expect(await adapter.respondToPermission({
        sessionID: "session-1",
        requestID: cancelID as string,
        outcome: { outcome: "cancelled" },
      })).toBe(true);
      expect(await cancelPending).toEqual({ outcome: { outcome: "cancelled" } });
    };

    try {
      const request = {
        ...makeGenerateTextRequest(),
        permissionMode: "forward" as const,
        publishEvent: (event: OpenCodeEvent) => { events.push(event); },
      };
      for await (const _ of adapter.generateText(request)) { /* drain */ }

      expect(events[0]).toMatchObject({
        type: "permission.requested",
        properties: {
          sessionID: "session-1",
          toolCall: { title: "Write file", kind: "write" },
          options: [{ optionId: "allow_once", name: "Allow once", kind: "allow_once" }],
        },
      });
    } finally {
      await adapter.dispose();
    }
  });

  test("forwarded permissions timeout to cancelled", async () => {
    const client = new FakeACPClient();
    const adapter = new ACPProtocolAdapter(
      makeBridgeConfig({ adapterMode: "acp", permissionTimeoutMs: 5 }),
      client,
    );
    let permissionResult: unknown;

    client.promptHook = async (sessionId) => {
      permissionResult = await client.invokeRequestHandler("session/request_permission", {
        sessionId,
        toolCall: { title: "Dangerous" },
        options: [{ optionId: "allow_once", name: "Allow", kind: "allow_once" }],
      });
    };

    try {
      for await (const _ of adapter.generateText({ ...makeGenerateTextRequest(), permissionMode: "forward" })) { /* drain */ }
      expect(permissionResult).toEqual({ outcome: { outcome: "cancelled" } });
    } finally {
      await adapter.dispose();
    }
  });
});




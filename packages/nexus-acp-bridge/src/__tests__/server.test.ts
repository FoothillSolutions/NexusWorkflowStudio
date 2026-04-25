import { afterEach, describe, expect, test } from "bun:test";
import { MockACPAdapter } from "../mock-acp-adapter";
import { NexusACPBridgeServer } from "../server";
import { makeBridgeConfig } from "./test-helpers";

const activeServers: NexusACPBridgeServer[] = [];

afterEach(() => {
  while (activeServers.length > 0) {
    activeServers.pop()?.stop();
  }
});

function startTestServer() {
  const config = makeBridgeConfig({ port: 0 });
  const bridge = new NexusACPBridgeServer(config, new MockACPAdapter(config));
  const server = bridge.start();
  activeServers.push(bridge);
  return `http://${server.hostname}:${server.port}`;
}

describe("NexusACPBridgeServer", () => {
  test("serves OpenCode-compatible commands", async () => {
    const baseUrl = startTestServer();
    const response = await fetch(`${baseUrl}/command`);
    const commands = await response.json() as Array<{ name: string; template: string }>;

    expect(response.ok).toBe(true);
    expect(commands.map((command) => command.name)).toEqual(["plan", "test", "web"]);
    expect(commands[0]?.template).toBe("/plan {request}");
  });

  test("advertises the Claude Code model catalog from /config/providers", async () => {
    const config = makeBridgeConfig({
      port: 0,
      selectedTool: "claude-code",
      defaultProviderId: "claude-code",
      defaultProviderName: "Claude Code",
      defaultModelId: "sonnet",
      defaultModelName: "Claude Sonnet",
    });
    const bridge = new NexusACPBridgeServer(config, new MockACPAdapter(config));
    const server = bridge.start();
    activeServers.push(bridge);

    const response = await fetch(`http://${server.hostname}:${server.port}/config/providers`);
    const payload = await response.json() as {
      providers: Array<{ id: string; models: Record<string, { name: string }> }>;
      default: Record<string, string>;
    };

    expect(response.ok).toBe(true);
    expect(Object.keys(payload.providers[0]?.models ?? {})).toEqual(["haiku", "sonnet", "opus"]);
    expect(payload.providers[0]?.models.sonnet?.name).toBe("Claude Sonnet");
    expect(payload.default["claude-code"]).toBe("sonnet");
  });

  test("executes session commands by translating them into slash-command prompts", async () => {
    const baseUrl = startTestServer();

    const sessionResponse = await fetch(`${baseUrl}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Command Test" }),
    });
    const session = await sessionResponse.json() as { id: string };

    const response = await fetch(`${baseUrl}/session/${encodeURIComponent(session.id)}/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        command: "plan",
        arguments: "triage production incidents",
      }),
    });
    const message = await response.json() as {
      parts: Array<{ type: string; text?: string }>;
      info: { role: string };
    };

    expect(response.ok).toBe(true);
    expect(message.info.role).toBe("assistant");
    expect(message.parts[0]?.type).toBe("text");
    expect(message.parts[0]?.text).toContain("/plan triage production incidents");
  });

  test("falls back to a random port when the configured port is already in use", async () => {
    const firstConfig = makeBridgeConfig({ port: 0 });
    const firstBridge = new NexusACPBridgeServer(firstConfig, new MockACPAdapter(firstConfig));
    const firstServer = firstBridge.start();
    activeServers.push(firstBridge);

    const requestedPort = firstServer.port;
    const secondConfig = makeBridgeConfig({ port: requestedPort });
    const secondBridge = new NexusACPBridgeServer(secondConfig, new MockACPAdapter(secondConfig));
    const secondServer = secondBridge.start();
    activeServers.push(secondBridge);

    expect(secondBridge.usedRandomPortFallback()).toBe(true);
    expect(secondServer.port).not.toBe(requestedPort);
    expect(secondServer.port).toBeGreaterThan(0);

    const response = await fetch(`http://${secondServer.hostname}:${secondServer.port}/global/health`);
    const health = await response.json() as { healthy: boolean };

    expect(response.ok).toBe(true);
    expect(health.healthy).toBe(true);
  });
});


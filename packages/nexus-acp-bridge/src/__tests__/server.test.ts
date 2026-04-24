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
});


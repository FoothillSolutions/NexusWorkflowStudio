import { afterEach, describe, expect, test } from "bun:test";
import { loadBridgeConfig, __private__ } from "../config";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
});

describe("bridge config", () => {
  test("parses adapter mode and quoted agent args", () => {
    process.env.NEXUS_ACP_BRIDGE_ADAPTER = "stdio";
    process.env.NEXUS_ACP_BRIDGE_AGENT_COMMAND = "claude";
    process.env.NEXUS_ACP_BRIDGE_AGENT_ARGS = '--model sonnet --label "two words"';

    const config = loadBridgeConfig();

    expect(config.adapterMode).toBe("stdio");
    expect(config.agentCommand).toBe("claude");
    expect(config.agentArgs).toEqual(["--model", "sonnet", "--label", "two words"]);
  });

  test("falls back to mock adapter mode by default", () => {
    delete process.env.NEXUS_ACP_BRIDGE_ADAPTER;

    const config = loadBridgeConfig();

    expect(config.adapterMode).toBe("mock");
  });

  test("parses ACP-specific protocol and method overrides", () => {
    process.env.NEXUS_ACP_BRIDGE_ADAPTER = "acp";
    process.env.NEXUS_ACP_BRIDGE_ACP_PROTOCOL = "newline";
    process.env.NEXUS_ACP_BRIDGE_ACP_METHOD_GENERATE = "chat/send";
    process.env.NEXUS_ACP_BRIDGE_ACP_NOTIFICATION_DELTA = "chat/delta";

    const config = loadBridgeConfig();

    expect(config.adapterMode).toBe("acp");
    expect(config.acpProtocol).toBe("newline");
    expect(config.acpMethods.generate).toBe("chat/send");
    expect(config.acpNotifications.textDelta).toBe("chat/delta");
  });

  test("parses command args helper with mixed quoting", () => {
    expect(__private__.parseCommandArgs("--a 1 'two words' \"three words\"")).toEqual([
      "--a",
      "1",
      "two words",
      "three words",
    ]);
  });
});


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
  test("loads the bundled default tool preset automatically", () => {
    delete process.env.NEXUS_ACP_BRIDGE_TOOL;
    delete process.env.NEXUS_ACP_BRIDGE_ADAPTER;
    delete process.env.NEXUS_ACP_BRIDGE_AGENT_COMMAND;
    delete process.env.NEXUS_ACP_BRIDGE_AGENT_ARGS;
    delete process.env.NEXUS_ACP_BRIDGE_PROVIDER_ID;
    delete process.env.NEXUS_ACP_BRIDGE_PROVIDER_NAME;
    delete process.env.NEXUS_ACP_BRIDGE_MODEL_ID;
    delete process.env.NEXUS_ACP_BRIDGE_MODEL_NAME;
    delete process.env.ACP_PERMISSION_MODE;

    const config = loadBridgeConfig([]);

    expect(config.selectedTool).toBe("claude-code");
    expect(config.adapterMode).toBe("acp");
    // agentCommand resolves to the vendored claude-agent-acp binary when it exists,
    // otherwise falls back to `npx`. Both forms end in `claude-agent-acp`.
    expect(config.agentCommand).toMatch(/claude-agent-acp$|^npx$/);
    if (config.agentCommand === "npx") {
      expect(config.agentArgs).toEqual(["--yes", "@agentclientprotocol/claude-agent-acp@0.31.0"]);
    } else {
      expect(config.agentArgs).toEqual([]);
    }
    expect(config.defaultProviderId).toBe("claude-code");
    expect(config.defaultProviderName).toBe("Claude Code");
    expect(config.defaultModelId).toBe("sonnet");
    expect(config.defaultModelName).toBe("Claude Sonnet");
    expect(String(process.env.ACP_PERMISSION_MODE)).toBe("bypassPermissions");
  });

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
    process.env.NEXUS_ACP_BRIDGE_ADAPTER = "mock";

    const config = loadBridgeConfig([]);

    expect(config.adapterMode).toBe("mock");
    expect(config.serverIdleTimeoutSeconds).toBe(0);
  });

  test("allows overriding the Bun server idle timeout", () => {
    process.env.NEXUS_ACP_BRIDGE_IDLE_TIMEOUT_SECONDS = "45";

    const config = loadBridgeConfig([]);

    expect(config.serverIdleTimeoutSeconds).toBe(45);
  });

  test("defaults permission handling to auto with a 60 second timeout", () => {
    delete process.env.NEXUS_ACP_BRIDGE_PERMISSION_MODE;
    delete process.env.NEXUS_ACP_BRIDGE_PERMISSION_TIMEOUT_MS;

    const config = loadBridgeConfig([]);

    expect(config.permissionMode).toBe("auto");
    expect(config.permissionTimeoutMs).toBe(60_000);
  });

  test("parses permission mode and timeout from env", () => {
    process.env.NEXUS_ACP_BRIDGE_PERMISSION_MODE = "forward";
    process.env.NEXUS_ACP_BRIDGE_PERMISSION_TIMEOUT_MS = "1234";

    const config = loadBridgeConfig([]);

    expect(config.permissionMode).toBe("forward");
    expect(config.permissionTimeoutMs).toBe(1234);
  });

  test("CLI permission mode overrides env and invalid values fall back to auto", () => {
    process.env.NEXUS_ACP_BRIDGE_PERMISSION_MODE = "invalid";
    expect(loadBridgeConfig([]).permissionMode).toBe("auto");

    const config = loadBridgeConfig(["--permission-mode=forward"]);
    expect(config.permissionMode).toBe("forward");
  });

  test("explicit environment variables override bundled defaults", () => {
    process.env.NEXUS_ACP_BRIDGE_ADAPTER = "stdio";
    process.env.NEXUS_ACP_BRIDGE_AGENT_COMMAND = "custom-agent";
    process.env.NEXUS_ACP_BRIDGE_AGENT_ARGS = "--flag custom";
    process.env.ACP_PERMISSION_MODE = "strict";

    const config = loadBridgeConfig();

    expect(config.adapterMode).toBe("stdio");
    expect(config.agentCommand).toBe("custom-agent");
    expect(config.agentArgs).toEqual(["--flag", "custom"]);
    expect(String(process.env.ACP_PERMISSION_MODE)).toBe("strict");
  });

  test("supports selecting Codex via CLI args", () => {
    delete process.env.NEXUS_ACP_BRIDGE_AGENT_COMMAND;
    delete process.env.NEXUS_ACP_BRIDGE_AGENT_ARGS;
    delete process.env.NEXUS_ACP_BRIDGE_PROVIDER_ID;
    delete process.env.NEXUS_ACP_BRIDGE_PROVIDER_NAME;
    delete process.env.NEXUS_ACP_BRIDGE_MODEL_ID;
    delete process.env.NEXUS_ACP_BRIDGE_MODEL_NAME;
    delete process.env.ACP_PERMISSION_MODE;

    const config = loadBridgeConfig(["--tool", "codex"]);

    expect(config.selectedTool).toBe("codex");
    expect(config.adapterMode).toBe("acp");
    expect(config.agentCommand).toBe("npx");
    expect(config.agentArgs).toEqual(["--yes", "@zed-industries/codex-acp"]);
    expect(config.defaultProviderId).toBe("codex");
    expect(process.env.ACP_PERMISSION_MODE).toBeUndefined();
  });

  test("CLI tool selection wins over env tool selection", () => {
    process.env.NEXUS_ACP_BRIDGE_TOOL = "claude-code";
    delete process.env.NEXUS_ACP_BRIDGE_AGENT_COMMAND;
    delete process.env.NEXUS_ACP_BRIDGE_AGENT_ARGS;
    delete process.env.NEXUS_ACP_BRIDGE_PROVIDER_ID;
    delete process.env.NEXUS_ACP_BRIDGE_PROVIDER_NAME;
    delete process.env.NEXUS_ACP_BRIDGE_MODEL_ID;
    delete process.env.NEXUS_ACP_BRIDGE_MODEL_NAME;
    delete process.env.ACP_PERMISSION_MODE;

    const config = loadBridgeConfig(["--tool=opencode"]);

    expect(config.selectedTool).toBe("opencode");
    expect(config.agentCommand).toBe("bunx");
    expect(config.agentArgs).toEqual(["opencode-ai", "acp"]);
    expect(config.defaultProviderId).toBe("opencode");
    // OpenCode preset uses 4081 so it can run side-by-side with the Claude bridge on 4080.
    expect(config.port).toBe(4081);
  });

  test("throws for unknown tool presets", () => {
    expect(() => loadBridgeConfig(["--tool", "unknown-tool"])).toThrow("Unknown bridge tool preset");
  });

  test("defaults to newline-framed ACP transport and protocol version 1", () => {
    delete process.env.NEXUS_ACP_BRIDGE_ACP_PROTOCOL;
    delete process.env.NEXUS_ACP_BRIDGE_ACP_PROTOCOL_VERSION;
    process.env.NEXUS_ACP_BRIDGE_ADAPTER = "acp";

    const config = loadBridgeConfig();

    expect(config.adapterMode).toBe("acp");
    expect(config.acpProtocol).toBe("newline");
    expect(config.acpProtocolVersion).toBe(1);
  });

  test("allows overriding ACP transport framing to content-length", () => {
    process.env.NEXUS_ACP_BRIDGE_ADAPTER = "acp";
    process.env.NEXUS_ACP_BRIDGE_ACP_PROTOCOL = "content-length";

    const config = loadBridgeConfig();

    expect(config.acpProtocol).toBe("content-length");
  });

  test("parses command args helper with mixed quoting", () => {
    expect(__private__.parseCommandArgs("--a 1 'two words' \"three words\"")).toEqual([
      "--a",
      "1",
      "two words",
      "three words",
    ]);
  });

  test("parses env files with comments, export syntax, and quotes", () => {
    expect(__private__.parseEnvFile([
      "# comment",
      'FOO="bar baz"',
      "export HELLO=world",
      "TRIM=ok # trailing comment",
      "",
    ].join("\n"))).toEqual({
      FOO: "bar baz",
      HELLO: "world",
      TRIM: "ok",
    });
  });

  test("parses CLI tool args helper", () => {
    expect(__private__.parseCliArgs(["--tool", "codex"])).toMatchObject({ tool: "codex" });
    expect(__private__.parseCliArgs(["--tool=opencode"])).toMatchObject({ tool: "opencode" });
    expect(__private__.parseCliArgs(["--agent", "claude"])).toMatchObject({ tool: "claude" });
    expect(__private__.parseCliArgs([])).toMatchObject({ tool: null });
  });

  test("--agent claude resolves to claude-code preset", () => {
    delete process.env.NEXUS_ACP_BRIDGE_TOOL;
    delete process.env.NEXUS_ACP_BRIDGE_AGENT_COMMAND;
    delete process.env.NEXUS_ACP_BRIDGE_AGENT_ARGS;
    delete process.env.NEXUS_ACP_BRIDGE_PROVIDER_ID;

    const config = loadBridgeConfig(["--agent", "claude"]);

    expect(config.selectedTool).toBe("claude-code");
    expect(config.defaultProviderId).toBe("claude-code");
  });

  test("CLI flags override env defaults for cors, port, host, project dirs", () => {
    delete process.env.NEXUS_ACP_BRIDGE_CORS_ORIGIN;
    delete process.env.NEXUS_ACP_BRIDGE_PORT;
    delete process.env.NEXUS_ACP_BRIDGE_HOST;
    delete process.env.NEXUS_ACP_BRIDGE_PROJECT_DIRS;
    delete process.env.NEXUS_ACP_BRIDGE_PROJECT_DIR;

    const config = loadBridgeConfig([
      "--cors", "http://localhost:9999",
      "--port=5555",
      "--host", "0.0.0.0",
      "--project-dir", "/tmp/a",
      "--project-dir=/tmp/b",
    ]);

    expect(config.corsOrigin).toBe("http://localhost:9999");
    expect(config.port).toBe(5555);
    expect(config.host).toBe("0.0.0.0");
    expect(config.projectDirs).toEqual(["/tmp/a", "/tmp/b"]);
  });

  test("--no-auto-setup disables claude vendor auto-install", () => {
    delete process.env.NEXUS_ACP_BRIDGE_AUTO_SETUP_CLAUDE;

    loadBridgeConfig(["--agent", "claude", "--no-auto-setup"]);

    expect(String(process.env.NEXUS_ACP_BRIDGE_AUTO_SETUP_CLAUDE)).toBe("0");
  });
});


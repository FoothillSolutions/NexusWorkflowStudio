import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ACP_BRIDGE_URL,
  DEFAULT_OPENCODE_BRIDGE_URL,
  DEFAULT_OPENCODE_URL,
  getAIConnectionPresets,
} from "@/lib/opencode/config";

describe("opencode config", () => {
  test("defaults Nexus to the local ACP bridge endpoint", () => {
    expect(DEFAULT_OPENCODE_URL).toBe(DEFAULT_ACP_BRIDGE_URL);
    expect(DEFAULT_OPENCODE_BRIDGE_URL).toBe("http://127.0.0.1:4081");
  });

  test("builds Claude Code and OpenCode bridge presets only", () => {
    const presets = getAIConnectionPresets("http://localhost:3001");

    expect(presets.map((preset) => preset.id)).toEqual([
      "claude-code-bridge",
      "opencode-bridge",
    ]);

    expect(presets[0]).toMatchObject({
      id: "claude-code-bridge",
      url: DEFAULT_ACP_BRIDGE_URL,
    });
    // No manual setup or install steps surfaced to the user — the server handles it.
    expect(presets[0]).not.toHaveProperty("setupCommand");
    expect(presets[0]).not.toHaveProperty("installCommand");
    expect(presets[0]?.startCommand).toBe('bun run bridge --agent claude --cors "http://localhost:3001"');

    // OpenCode bridge runs on its own port so it can coexist with the Claude bridge.
    expect(presets[1]).toMatchObject({
      id: "opencode-bridge",
      url: DEFAULT_OPENCODE_BRIDGE_URL,
    });
    expect(presets[1]).not.toHaveProperty("installCommand");
    expect(presets[1]?.startCommand).toBe('bun run bridge --agent opencode --cors "http://localhost:3001"');
  });
});


import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ACP_BRIDGE_URL,
  DEFAULT_DIRECT_OPENCODE_URL,
  DEFAULT_OPENCODE_URL,
  getAIConnectionPresets,
} from "@/lib/opencode/config";

describe("opencode config", () => {
  test("defaults Nexus to the local ACP bridge endpoint", () => {
    expect(DEFAULT_OPENCODE_URL).toBe(DEFAULT_ACP_BRIDGE_URL);
  });

  test("builds Claude Code, OpenCode bridge, and direct OpenCode presets", () => {
    const presets = getAIConnectionPresets("http://localhost:3001");

    expect(presets.map((preset) => preset.id)).toEqual([
      "claude-code-bridge",
      "opencode-bridge",
      "opencode-direct",
    ]);

    expect(presets[0]).toMatchObject({
      id: "claude-code-bridge",
      url: DEFAULT_ACP_BRIDGE_URL,
      setupCommand: "bun run bridge:setup-claude",
    });
    expect(presets[0]?.startCommand).toContain('NEXUS_ACP_BRIDGE_CORS_ORIGIN="http://localhost:3001" bun run bridge:acp:claude');

    expect(presets[1]).toMatchObject({
      id: "opencode-bridge",
      url: DEFAULT_ACP_BRIDGE_URL,
      installCommand: "bun add -g opencode-ai",
    });
    expect(presets[1]?.startCommand).toContain('NEXUS_ACP_BRIDGE_CORS_ORIGIN="http://localhost:3001" bun run bridge:acp:opencode');

    expect(presets[2]).toMatchObject({
      id: "opencode-direct",
      url: DEFAULT_DIRECT_OPENCODE_URL,
      installCommand: "bun add -g opencode-ai",
    });
    expect(presets[2]?.startCommand).toBe("opencode serve --cors http://localhost:3001");
  });
});


import { describe, expect, it } from "bun:test";
import type { Provider } from "@/lib/opencode/types";
import {
  buildModelGroups,
  getProviderColors,
  resolveVendor,
} from "../../opencode";

function makeProvider(id: string, name: string, models: Provider["models"]): Provider {
  return {
    id,
    name,
    source: "api",
    env: [],
    options: {},
    models,
  };
}

function makeModel(
  providerID: string,
  id: string,
  name: string,
  family?: string,
  status: "alpha" | "beta" | "deprecated" | "active" = "active",
): Provider["models"][string] {
  return {
    id,
    providerID,
    api: { id: providerID, url: "http://localhost:4096", npm: "opencode-ai" },
    name,
    family,
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: false,
      toolcall: false,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 200_000, output: 4_096 },
    status,
    options: {},
    headers: {},
    release_date: "2026-01-01",
  };
}

describe("opencode model helpers", () => {
  it("resolves known vendor families and falls back for unknown values", () => {
    expect(resolveVendor("claude-sonnet")).toEqual(
      expect.objectContaining({ label: "Anthropic", order: 0 }),
    );
    expect(resolveVendor("gpt-5")).toEqual(
      expect.objectContaining({ label: "OpenAI", order: 2 }),
    );
    expect(resolveVendor("custom-family")).toBeNull();
    expect(resolveVendor(undefined)).toBeNull();
  });

  it("uses known provider colors before cycling through fallback colors", () => {
    expect(getProviderColors("claude-code", 99)).toEqual({
      color: "bg-orange-400",
      textColor: "text-orange-400/70",
    });
    expect(getProviderColors("github-copilot", 99)).toEqual({
      color: "bg-blue-400",
      textColor: "text-blue-400/70",
    });
    expect(getProviderColors("unknown-provider", 1)).toEqual({
      color: "bg-emerald-400",
      textColor: "text-emerald-400/70",
    });
  });

  it("builds a flat group for small providers and skips inactive models", () => {
    const groups = buildModelGroups([
      makeProvider("github-copilot", "GitHub Copilot", {
        "gpt-4.1": makeModel("github-copilot", "gpt-4.1", "GPT 4.1", "gpt-4.1"),
        "claude-3.7": makeModel("github-copilot", "claude-3.7", "Claude 3.7", "claude-3.7"),
        old: makeModel("github-copilot", "old", "Old Model", "gpt-old", "deprecated"),
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: "GitHub Copilot",
      providerId: "github-copilot",
      color: "bg-blue-400",
      textColor: "text-blue-400/70",
    });
    expect(groups[0].models.map((model) => model.displayName)).toEqual([
      "Claude 3.7",
      "GPT 4.1",
    ]);
  });

  it("uses the Claude Code orange color for flat claude-code providers", () => {
    const groups = buildModelGroups([
      makeProvider("claude-code", "Claude Code", {
        sonnet: makeModel("claude-code", "sonnet", "Claude Sonnet", "claude-sonnet"),
        opus: makeModel("claude-code", "opus", "Claude Opus", "claude-opus"),
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: "Claude Code",
      providerId: "claude-code",
      color: "bg-orange-400",
      textColor: "text-orange-400/70",
    });
    expect(groups[0].models.map((model) => model.displayName)).toEqual([
      "Claude Opus",
      "Claude Sonnet",
    ]);
  });

  it("sub-groups large multi-vendor providers and keeps unmatched models in an other bucket", () => {
    const groups = buildModelGroups([
      makeProvider("github-copilot", "GitHub Copilot", {
        "claude-opus": makeModel("github-copilot", "claude-opus", "Claude Opus", "claude-opus"),
        "claude-sonnet": makeModel("github-copilot", "claude-sonnet", "Claude Sonnet", "claude-sonnet"),
        "gemini-2.5": makeModel("github-copilot", "gemini-2.5", "Gemini 2.5", "gemini-2.5"),
        "gemini-flash": makeModel("github-copilot", "gemini-flash", "Gemini Flash", "gemini-flash"),
        "gpt-4.1": makeModel("github-copilot", "gpt-4.1", "GPT 4.1", "gpt-4.1"),
        "gpt-4.1-mini": makeModel("github-copilot", "gpt-4.1-mini", "GPT 4.1 Mini", "gpt-4.1-mini"),
        custom: makeModel("github-copilot", "custom", "Custom Lab", "lab-custom"),
      }),
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      "GitHub Copilot · Anthropic",
      "GitHub Copilot · Google",
      "GitHub Copilot · OpenAI",
      "GitHub Copilot · Other",
    ]);
    expect(groups[0].models.map((model) => model.displayName)).toEqual([
      "Claude Opus",
      "Claude Sonnet",
    ]);
    expect(groups[3].models.map((model) => model.displayName)).toEqual(["Custom Lab"]);
  });
});


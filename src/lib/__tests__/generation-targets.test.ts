import { describe, expect, it } from "bun:test";
import {
  buildGeneratedAgentFilePath,
  buildGeneratedCommandFilePath,
  buildGeneratedDocsFilePath,
  buildGeneratedSkillFilePath,
  buildGeneratedSkillScriptFilePath,
  DEFAULT_GENERATION_TARGET,
  getGenerationTarget,
  sanitizeGeneratedName,
} from "../generation-targets";

describe("generation-targets", () => {
  it("falls back to the default target when no target is provided", () => {
    expect(getGenerationTarget()).toEqual(getGenerationTarget(DEFAULT_GENERATION_TARGET));
    expect(getGenerationTarget("opencode").rootDir).toBe(".opencode");
    expect(getGenerationTarget("pi").rootDir).toBe(".pi");
    expect(getGenerationTarget("claude-code").rootDir).toBe(".claude");
  });

  it("sanitizes generated names and preserves a useful fallback", () => {
    expect(sanitizeGeneratedName("My Workflow 2026!")).toBe("my-workflow-2026");
    expect(sanitizeGeneratedName("   ", "fallback-name")).toBe("fallback-name");
    expect(sanitizeGeneratedName("feature_branch-v2")).toBe("feature_branch-v2");
  });

  it("builds command, agent, skill, script, and docs paths per target", () => {
    // Default target is now claude-code (.claude/...)
    expect(buildGeneratedCommandFilePath("review-workflow")).toBe(
      ".claude/commands/review-workflow.md",
    );
    expect(buildGeneratedCommandFilePath("review-workflow", "pi")).toBe(
      ".pi/commands/review-workflow.md",
    );

    expect(buildGeneratedAgentFilePath("review-agent", "claude-code")).toBe(
      ".claude/agents/review-agent.md",
    );
    expect(buildGeneratedSkillFilePath("code-review", "opencode")).toBe(
      ".opencode/skills/code-review/SKILL.md",
    );
    expect(
      buildGeneratedSkillScriptFilePath("code-review", "lint-fix.ts", "claude-code"),
    ).toBe(".claude/skills/code-review/scripts/lint-fix.ts");
    expect(buildGeneratedDocsFilePath("guides/api.md", "pi")).toBe(
      ".pi/docs/guides/api.md",
    );
  });
});


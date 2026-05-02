import { describe, expect, it } from "bun:test";
import {
  buildGeneratedAgentFilePath,
  buildGeneratedCommandFilePath,
  buildGeneratedDocsFilePath,
  buildGeneratedDocsReferencePath,
  buildGeneratedSkillFilePath,
  buildGeneratedSkillReferencePath,
  buildGeneratedSkillScriptFilePath,
  buildGeneratedSkillScriptReferencePath,
  buildGeneratedSubWorkflowCommandFilePath,
  DEFAULT_GENERATION_TARGET,
  getGenerationTarget,
  sanitizeGeneratedName,
} from "../generation-targets";

describe("generation-targets", () => {
  it("falls back to the default target when no target is provided", () => {
    expect(getGenerationTarget()).toEqual(getGenerationTarget(DEFAULT_GENERATION_TARGET));
    expect(getGenerationTarget("opencode").rootDir).toBe(".opencode");
    expect(getGenerationTarget("pi").rootDir).toBe(".pi");
    expect(getGenerationTarget("claude-code").rootDir).toBe("plugin root");
    expect(getGenerationTarget("claude-code").compatibility).toBe("claude-plugin");
  });

  it("sanitizes generated names and preserves a useful fallback", () => {
    expect(sanitizeGeneratedName("My Workflow 2026!")).toBe("my-workflow-2026");
    expect(sanitizeGeneratedName("   ", "fallback-name")).toBe("fallback-name");
    expect(sanitizeGeneratedName("feature_branch-v2")).toBe("feature_branch-v2");
  });

  it("keeps OpenCode and PI command, agent, skill, script, and docs paths unchanged", () => {
    expect(buildGeneratedCommandFilePath("review-workflow")).toBe(
      ".opencode/commands/review-workflow.md",
    );
    expect(buildGeneratedCommandFilePath("review-workflow", "pi")).toBe(
      ".pi/commands/review-workflow.md",
    );
    expect(buildGeneratedAgentFilePath("review-agent", "opencode")).toBe(
      ".opencode/agents/review-agent.md",
    );
    expect(buildGeneratedSkillFilePath("code-review", "opencode")).toBe(
      ".opencode/skills/code-review/SKILL.md",
    );
    expect(buildGeneratedSkillScriptFilePath("code-review", "lint-fix.ts", "pi")).toBe(
      ".pi/skills/code-review/scripts/lint-fix.ts",
    );
    expect(buildGeneratedDocsFilePath("guides/api.md", "pi")).toBe(
      ".pi/docs/guides/api.md",
    );
  });

  it("builds Claude plugin-root artifact paths", () => {
    expect(buildGeneratedCommandFilePath("review-workflow", "claude-code")).toBe(
      "skills/run/SKILL.md",
    );
    expect(buildGeneratedSubWorkflowCommandFilePath("sub_review", "claude-code")).toBe(
      "skills/sub-review/SKILL.md",
    );
    expect(buildGeneratedAgentFilePath("review-agent", "claude-code")).toBe(
      "agents/review-agent.md",
    );
    expect(buildGeneratedSkillFilePath("code-review", "claude-code")).toBe(
      "skills/code-review/SKILL.md",
    );
    expect(buildGeneratedSkillScriptFilePath("code-review", "lint-fix.ts", "claude-code")).toBe(
      "skills/code-review/scripts/lint-fix.ts",
    );
    expect(buildGeneratedDocsFilePath("guides/api.md", "claude-code")).toBe(
      "docs/guides/api.md",
    );
  });

  it("builds target-specific resource reference paths", () => {
    expect(buildGeneratedSkillReferencePath("code-review", "opencode")).toBe(
      ".opencode/skills/code-review/SKILL.md",
    );
    expect(buildGeneratedDocsReferencePath("guides/api.md", "pi")).toBe(
      ".pi/docs/guides/api.md",
    );
    expect(buildGeneratedSkillReferencePath("code-review", "claude-code")).toBe(
      "${CLAUDE_PLUGIN_ROOT}/skills/code-review/SKILL.md",
    );
    expect(buildGeneratedDocsReferencePath("guides/api.md", "claude-code")).toBe(
      "${CLAUDE_PLUGIN_ROOT}/docs/guides/api.md",
    );
    expect(buildGeneratedSkillScriptReferencePath("code-review", "lint-fix.ts", "claude-code")).toBe(
      "${CLAUDE_PLUGIN_ROOT}/skills/code-review/scripts/lint-fix.ts",
    );
  });
});

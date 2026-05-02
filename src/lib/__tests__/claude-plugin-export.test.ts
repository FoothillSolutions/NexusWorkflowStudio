import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildClaudeDocsReferencePath,
  buildClaudePluginManifest,
  buildClaudePluginName,
  buildClaudeSkillReferencePath,
  buildClaudeSkillScriptReferencePath,
} from "@/lib/claude-plugin-export";
import { generateWorkflowFiles } from "@/lib/workflow-generator";
import { makeWorkflowEdge, makeWorkflowNode } from "@/test-support/workflow-fixtures";
import { SubAgentMemory, WorkflowNodeType, type WorkflowJSON, type WorkflowNode } from "@/types/workflow";

function representativeWorkflow(): WorkflowJSON {
  const start = makeWorkflowNode({
    id: "start-1",
    type: WorkflowNodeType.Start,
    data: { type: WorkflowNodeType.Start, label: "Start", name: "start" } as WorkflowNode["data"],
  });
  const agent = makeWorkflowNode({
    id: "agent-reviewer",
    type: WorkflowNodeType.Agent,
    data: {
      type: WorkflowNodeType.Agent,
      label: "Reviewer",
      name: "reviewer",
      description: "Review code changes",
      promptText: "Review the pull request using the bundled resources.",
      detectedVariables: [],
      model: "",
      memory: SubAgentMemory.Default,
      temperature: 0,
      color: "#0ea5e9",
      disabledTools: [],
      parameterMappings: [],
      variableMappings: {
        guide: "doc:guides/review.md",
        checklist: "skill:code-review",
      },
    } as WorkflowNode["data"],
  });
  const skill = makeWorkflowNode({
    id: "skill-review",
    type: WorkflowNodeType.Skill,
    data: {
      type: WorkflowNodeType.Skill,
      label: "code-review",
      name: "code-review",
      skillName: "code-review",
      description: "Code review checklist",
      promptText: "Use the script output and inspect changed files.",
      detectedVariables: [],
      variableMappings: {},
      metadata: [],
    } as WorkflowNode["data"],
  });
  const script = makeWorkflowNode({
    id: "script-lint",
    type: WorkflowNodeType.Script,
    data: {
      type: WorkflowNodeType.Script,
      label: "lint-fix.ts",
      name: "lint-fix.ts",
      promptText: "console.log('lint');\n",
      detectedVariables: [],
    } as WorkflowNode["data"],
  });
  const doc = makeWorkflowNode({
    id: "doc-guide",
    type: WorkflowNodeType.Document,
    data: {
      type: WorkflowNodeType.Document,
      label: "Review Guide",
      name: "review-guide",
      docName: "review",
      docSubfolder: "guides",
      contentMode: "inline",
      fileExtension: "md",
      contentText: "# Review guide\n",
      linkedFileName: null,
      linkedFileContent: null,
      description: "",
      brainDocId: null,
    } as WorkflowNode["data"],
  });
  const end = makeWorkflowNode({
    id: "end-1",
    type: WorkflowNodeType.End,
    data: { type: WorkflowNodeType.End, label: "End", name: "end" } as WorkflowNode["data"],
  });

  return {
    name: "Review PR",
    nodes: [start, skill, script, doc, agent, end],
    edges: [
      makeWorkflowEdge({ id: "e-start-agent", source: "start-1", target: "agent-reviewer", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-agent-end", source: "agent-reviewer", target: "end-1", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-skill-agent", source: "skill-review", target: "agent-reviewer", sourceHandle: "skill-out", targetHandle: "skills" }),
      makeWorkflowEdge({ id: "e-doc-agent", source: "doc-guide", target: "agent-reviewer", sourceHandle: "doc-out", targetHandle: "docs" }),
      makeWorkflowEdge({ id: "e-script-skill", source: "script-lint", target: "skill-review", sourceHandle: "output", targetHandle: "scripts" }),
    ],
    ui: { sidebarOpen: false, minimapVisible: false, viewport: { x: 0, y: 0, zoom: 1 } },
  };
}

function writeGeneratedFiles(root: string, files: Array<{ path: string; content: string }>): void {
  for (const file of files) {
    const filePath = join(root, file.path);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, file.content, "utf8");
  }
}

describe("claude-plugin-export helpers", () => {
  it("builds Claude-compatible plugin names", () => {
    expect(buildClaudePluginName("Review PR")).toBe("nexus-review-pr");
    expect(buildClaudePluginName("  ACME___Review!!! PR  ")).toBe("nexus-acme-review-pr");
    expect(buildClaudePluginName("!!!")).toBe("nexus-workflow");
    const longName = buildClaudePluginName("This Workflow Name Is Long Enough To Exceed The Claude Plugin Name Maximum Length By A Lot");
    expect(longName).toHaveLength(64);
    expect(longName).toMatch(/^nexus-[a-z0-9-]+$/);
    expect(longName.endsWith("-")).toBe(false);
  });

  it("builds a supported manifest shape", () => {
    const manifest = JSON.parse(buildClaudePluginManifest({ name: "Review PR" })) as Record<string, unknown>;
    expect(Object.keys(manifest).sort()).toEqual(["author", "description", "keywords", "name"]);
    expect(manifest.name).toBe("nexus-review-pr");
    expect(manifest.author).toEqual({ name: "Nexus Workflow Studio" });
    expect(manifest.keywords).toEqual(["nexus", "workflow", "claude-plugin"]);
  });

  it("builds plugin-root resource references", () => {
    expect(buildClaudeSkillReferencePath("code-review")).toBe("${CLAUDE_PLUGIN_ROOT}/skills/code-review/SKILL.md");
    expect(buildClaudeDocsReferencePath("guides/review.md")).toBe("${CLAUDE_PLUGIN_ROOT}/docs/guides/review.md");
    expect(buildClaudeSkillScriptReferencePath("code-review", "lint-fix.ts")).toBe("${CLAUDE_PLUGIN_ROOT}/skills/code-review/scripts/lint-fix.ts");
  });
});

describe("generateWorkflowFiles claude-code plugin output", () => {
  it("generates a plugin-root package with bundled resources and no legacy Claude paths or run scripts", () => {
    const workflow = representativeWorkflow();
    const files = generateWorkflowFiles(workflow, "claude-code");
    const paths = files.map((file) => file.path).sort();

    expect(paths).toContain(".claude-plugin/plugin.json");
    expect(paths).toContain("skills/run/SKILL.md");
    expect(paths).toContain("agents/reviewer.md");
    expect(paths).toContain("skills/code-review/SKILL.md");
    expect(paths).toContain("skills/code-review/scripts/lint-fix.ts");
    expect(paths).toContain("docs/guides/review.md");
    expect(paths).toContain("nexus/review-pr.json");
    expect(paths).toContain("README.md");
    expect(paths.some((path) => path.startsWith("run-review-pr."))).toBe(false);
    expect(paths.some((path) => path.includes("commands/"))).toBe(false);

    for (const file of files) {
      expect(file.path).not.toContain(".claude/");
      expect(file.content).not.toContain(".claude/");
    }

    const runSkill = files.find((file) => file.path === "skills/run/SKILL.md");
    expect(runSkill?.content).toContain("name: run");
    expect(runSkill?.content).toContain("disable-model-invocation: true");
    expect(runSkill?.content).toContain("${CLAUDE_PLUGIN_ROOT}/skills/code-review/SKILL.md");
    expect(runSkill?.content).toContain("${CLAUDE_PLUGIN_ROOT}/docs/guides/review.md");

    const agentFile = files.find((file) => file.path === "agents/reviewer.md");
    expect(agentFile?.content).toContain("${CLAUDE_PLUGIN_ROOT}/docs/guides/review.md");
    expect(agentFile?.content).toContain("${CLAUDE_PLUGIN_ROOT}/skills/code-review/SKILL.md");

    const workflowJson = files.find((file) => file.path === "nexus/review-pr.json");
    expect(JSON.parse(workflowJson?.content ?? "{}").name).toBe("Review PR");
  });

  it("passes claude plugin validate for a representative generated plugin", () => {
    const pluginDir = mkdtempSync(join(tmpdir(), "nexus-claude-plugin-"));
    const files = generateWorkflowFiles(representativeWorkflow(), "claude-code");
    writeGeneratedFiles(pluginDir, files);

    const result = spawnSync("claude", ["plugin", "validate", pluginDir], { encoding: "utf8" });
    expect(
      result.status,
      `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    ).toBe(0);
  });
});

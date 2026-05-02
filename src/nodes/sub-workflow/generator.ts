import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData, WorkflowJSON } from "@/types/workflow";
import { NODE_ACCENT } from "@/lib/node-colors";
import {
  buildGeneratedAgentFilePath,
  buildGeneratedSkillReferencePath,
  DEFAULT_GENERATION_TARGET,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import { SubAgentModel } from "@/nodes/agent/enums";
import {
  mapColorForClaudeCode,
  mapModelForClaudeCode,
  mapToolForClaudeCode,
} from "@/nodes/shared/claude-code-frontmatter";
import type { SubWorkflowNodeData } from "./types";

/** Sanitise a human label into a safe kebab-case slug. */
function toSafeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "sub-workflow";
}

/**
 * Build a self-contained WorkflowJSON from the sub-workflow's embedded data
 * so we can reuse the top-level generator functions.
 */
function toWorkflowJSON(d: SubWorkflowNodeData): WorkflowJSON {
  return {
    name: d.label || "Sub Workflow",
    nodes: d.subNodes ?? [],
    edges: d.subEdges ?? [],
    ui: { sidebarOpen: false, minimapVisible: false, viewport: { x: 0, y: 0, zoom: 1 } },
  };
}

/**
 * Build a `<root>/agents/<name>.md` frontmatter + body for agent mode.
 * The body tells the agent to "Call /workflow-name".
 */
function buildSubWorkflowAgentFile(
  d: SubWorkflowNodeData,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  const workflowSlug = toSafeName(d.label || "Sub Workflow");
  const description = `Execute the ${d.label || "Sub Workflow"} workflow`;
  const accent = d.color || NODE_ACCENT["sub-workflow"];

  const lines: string[] = ["---"];

  if (target === "claude-code") {
    // Claude Code's frontmatter only accepts the fields documented at
    // https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields.
    lines.push(`name: ${workflowSlug}`);
    lines.push(`description: ${description}`);

    if (d.model && d.model !== SubAgentModel.Inherit) {
      const mapped = mapModelForClaudeCode(d.model);
      if (mapped) lines.push(`model: ${mapped}`);
    }

    if (Array.isArray(d.disabledTools) && d.disabledTools.length > 0) {
      const mapped = d.disabledTools
        .map(mapToolForClaudeCode)
        .filter((t): t is string => t !== null);
      if (mapped.length > 0) {
        lines.push(`disallowedTools: ${mapped.join(", ")}`);
      }
    }

    const color = mapColorForClaudeCode(accent);
    if (color) lines.push(`color: ${color}`);
  } else {
    lines.push(`description: ${description}`);
    lines.push(`mode: subagent`);
    lines.push(`hidden: true`);

    if (d.model && d.model !== SubAgentModel.Inherit) {
      lines.push(`model: ${d.model}`);
    }

    if (Array.isArray(d.disabledTools) && d.disabledTools.length > 0) {
      lines.push(`tools:`);
      for (const tool of d.disabledTools) {
        lines.push(`  ${tool}: false`);
      }
    }

    if (d.temperature && d.temperature > 0) {
      lines.push(`temperature: ${parseFloat(d.temperature.toFixed(1))}`);
    }

    lines.push(`color: "${accent}"`);
  }

  lines.push("---");
  lines.push("");
  if (target === "claude-code") {
    lines.push(`Run the bundled sub-workflow skill at \`${buildGeneratedSkillReferencePath(workflowSlug, target)}\`.`);
    lines.push(`After plugin installation it can be invoked as \`/<plugin-name>:${workflowSlug}\`.`);
  } else {
    lines.push(`Call /${workflowSlug}`);
  }

  return lines.join("\n");
}

export const generator: NodeGeneratorModule & {
  getSubWorkflowJSON?(nodeId: string, data: WorkflowNodeData): WorkflowJSON | null;
  getAgentFile?(
    nodeId: string,
    data: WorkflowNodeData,
    connectedSkillNames?: string[],
    connectedDocNames?: string[],
    target?: GenerationTargetId,
  ): { path: string; content: string } | null;
} = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubWorkflowNodeData;
    const label = d.label || "Sub Workflow";
    if (d.mode === "agent") {
      const agentSlug = toSafeName(label);
      return `    ${mermaidId(nodeId)}["Agent: ${mermaidLabel(agentSlug)}"]`;
    }
    // Same-context: show as a sub-routine rectangle (double brackets = subroutine in mermaid)
    return `    ${mermaidId(nodeId)}[["Sub: ${mermaidLabel(label)}"]]`;
  },

  /**
   * For agent mode, returns the delegation details.
   * For same-context mode, returns a placeholder — the real inline content
   * is built by `buildSubWorkflowDetailsSection` in workflow-generator.ts
   * which has access to `buildCommandMarkdown` without circular imports.
   */
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubWorkflowNodeData;
    const label = d.label || "Sub Workflow";
    const slug = toSafeName(label);

    if (d.mode === "agent") {
      return [
        `#### ${mermaidId(nodeId)}(Agent: ${slug})`,
        "",
        "```",
        `delegate agent: @${slug}`,
        "```",
      ].join("\n");
    }

    // Same-context: reference the sub-workflow command file by mermaid node ID
    const mid = mermaidId(nodeId);
    return [
      `#### ${mid}`,
      "",
      "```bash",
      `/${mid}`,
      "```",
    ].join("\n");
  },

  getSubWorkflowJSON(_nodeId: string, data: WorkflowNodeData): WorkflowJSON | null {
    const d = data as SubWorkflowNodeData;
    if (!d.subNodes || d.subNodes.length === 0) return null;
    return toWorkflowJSON(d);
  },

  getAgentFile(
    _nodeId: string,
    data: WorkflowNodeData,
    _connectedSkillNames?: string[],
    _connectedDocNames?: string[],
    target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
  ): { path: string; content: string } | null {
    const d = data as SubWorkflowNodeData;
    if (d.mode !== "agent") return null;
    const agentSlug = toSafeName(d.label || "Sub Workflow");
    return {
      path: buildGeneratedAgentFilePath(agentSlug, target),
      content: buildSubWorkflowAgentFile(d, target),
    };
  },
};


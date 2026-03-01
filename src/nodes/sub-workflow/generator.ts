import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData, WorkflowJSON } from "@/types/workflow";
import { NODE_ACCENT } from "@/lib/node-colors";
import { SubAgentModel } from "@/nodes/sub-agent/enums";
import type { SubWorkflowNodeData } from "./types";

/** Sanitise a human label into a safe kebab-case slug. */
function toSafeName(raw: string): string {
  return raw
    .replace(/[^a-z0-9\-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "sub-workflow";
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
 * Build a `.opencode/agents/<name>.md` frontmatter + body for agent mode.
 * The body tells the agent to "Call /workflow-name".
 */
function buildSubWorkflowAgentFile(d: SubWorkflowNodeData): string {
  const workflowSlug = toSafeName(d.label || "Sub Workflow");

  const lines: string[] = ["---"];
  lines.push(`description: Execute the ${d.label || "Sub Workflow"} workflow`);
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

  lines.push(`color: "${d.color || NODE_ACCENT["sub-workflow"]}"`);
  lines.push("---");
  lines.push("");
  lines.push(`Call /${workflowSlug}`);

  return lines.join("\n");
}

export const generator: NodeGeneratorModule & {
  getSubWorkflowJSON?(nodeId: string, data: WorkflowNodeData): WorkflowJSON | null;
  getAgentFile?(nodeId: string, data: WorkflowNodeData): { path: string; content: string } | null;
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

  getAgentFile(_nodeId: string, data: WorkflowNodeData): { path: string; content: string } | null {
    const d = data as SubWorkflowNodeData;
    if (d.mode !== "agent") return null;
    const agentSlug = toSafeName(d.label || "Sub Workflow");
    return {
      path: `.opencode/agents/${agentSlug}.md`,
      content: buildSubWorkflowAgentFile(d),
    };
  },
};


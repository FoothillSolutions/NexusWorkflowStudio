import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SubAgentNodeData } from "./types";
import { SubAgentModel } from "./types";

/**
 * Build the frontmatter + prompt content for a .opencode/agents/<name>.md file.
 */
export function buildAgentFile(nodeId: string, d: SubAgentNodeData): string {
  const agentName = d.name || `agent-${nodeId}`;

  // --- frontmatter ---
  const lines: string[] = ["---"];
  lines.push(`description: ${d.description || d.label || agentName}`);
  lines.push(`mode: subagent`);
  lines.push(`hidden: true`);

  if (d.model && d.model !== SubAgentModel.Inherit) {
    lines.push(`model: ${d.model}`);
  }

  // Only emit tools block if some are disabled
  if (Array.isArray(d.disabledTools) && d.disabledTools.length > 0) {
    lines.push(`tools:`);
    for (const tool of d.disabledTools) {
      lines.push(`  ${tool}: false`);
    }
  }

  if (d.temperature && d.temperature > 0) {
    lines.push(`temperature: ${parseFloat(d.temperature.toFixed(1))}`);
  }

  lines.push(`color: "${d.color || "#5f27cd"}"`);

  lines.push("---");
  lines.push("");
  if (d.promptText) lines.push(d.promptText);

  return lines.join("\n");
}

export const generator: NodeGeneratorModule & {
  getAgentFile?(nodeId: string, data: WorkflowNodeData): { path: string; content: string } | null;
} = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    return `    ${mermaidId(nodeId)}["Sub-Agent: ${mermaidLabel(agentName)}"]`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    return [
      `#### ${nodeId}(Sub-Agent: ${agentName})`,
      "",
      "```",
      `delegate agent: @${agentName}`,
      "```",
    ].join("\n");
  },

  getAgentFile(nodeId: string, data: WorkflowNodeData) {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    return {
      path: `.opencode/agents/${agentName}.md`,
      content: buildAgentFile(nodeId, d),
    };
  },
};
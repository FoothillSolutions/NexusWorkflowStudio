import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import { NODE_ACCENT } from "@/lib/node-colors";
import type { SubAgentNodeData } from "./types";
import { SubAgentModel } from "./types";

/**
 * Build the frontmatter + prompt content for a .opencode/agents/<name>.md file.
 */
export function buildAgentFile(nodeId: string, d: SubAgentNodeData, connectedSkillNames?: string[]): string {
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

  // Emit connected skills
  if (connectedSkillNames && connectedSkillNames.length > 0) {
    lines.push(`skills:`);
    for (const name of connectedSkillNames) {
      lines.push(`  - ${name}`);
    }
  }

  if (d.temperature && d.temperature > 0) {
    lines.push(`temperature: ${parseFloat(d.temperature.toFixed(1))}`);
  }

  lines.push(`color: "${d.color || NODE_ACCENT.agent}"`);

  lines.push("---");
  lines.push("");
  if (d.promptText) lines.push(d.promptText);

  return lines.join("\n");
}

export const generator: NodeGeneratorModule & {
  getAgentFile?(nodeId: string, data: WorkflowNodeData, connectedSkillNames?: string[]): { path: string; content: string } | null;
} = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    return `    ${mermaidId(nodeId)}["Agent: ${mermaidLabel(agentName)}"]`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    const lines = [
      `#### ${nodeId}`,
      "",
      "```",
      `delegate agent: @${agentName}`,
    ];
    // Append parameter mappings if configured
    const mappings = (d.parameterMappings ?? []).map((v) => v.trim()).filter(Boolean);
    if (mappings.length > 0) {
      lines.push(`params: ${mappings.join(", ")}`);
    }
    lines.push("```");
    return lines.join("\n");
  },

  getAgentFile(nodeId: string, data: WorkflowNodeData, connectedSkillNames?: string[]) {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    return {
      path: `.opencode/agents/${agentName}.md`,
      content: buildAgentFile(nodeId, d, connectedSkillNames),
    };
  },
};
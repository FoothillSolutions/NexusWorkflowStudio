import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SubAgentNodeData } from "./types";
export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentNodeData;
    return `    ${mermaidId(nodeId)}["Sub-Agent: ${mermaidLabel(d.label || d.name)}"]`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentNodeData;
    const nodeLabel = d.label || d.name;
    const rows = [
      `#### Sub-Agent: ${nodeLabel}`,
      "",
      `- **Model:** ${d.model}`,
      `- **Memory:** ${d.memory}`,
    ];
    if (d.tools) rows.push(`- **Tools:** ${d.tools}`);
    if (d.promptText) rows.push("", "**Prompt:**", "```", d.promptText, "```");
    if (d.detectedVariables.length > 0) {
      rows.push("", `**Variables:** ${d.detectedVariables.map((v) => `\`${v}\``).join(", ")}`);
    }
    return rows.join("\n");
  },
};
import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { McpToolNodeData } from "./types";
export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as McpToolNodeData;
    return `    ${mermaidId(nodeId)}["MCP Tool: ${mermaidLabel(d.toolName || d.label)}"]`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as McpToolNodeData;
    const rows = [`#### MCP Tool: ${d.label || d.name}`, "", `- **Tool Name:** ${d.toolName || "_not set_"}`];
    if (d.paramsText) rows.push("", "**Parameters:**", "```", d.paramsText, "```");
    return rows.join("\n");
  },
};
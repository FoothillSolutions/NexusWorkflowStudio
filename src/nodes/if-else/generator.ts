import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { IfElseNodeData } from "./types";
export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as IfElseNodeData;
    const expr = d.expression;
    const label = expr ? `Branch: ${mermaidLabel(expr)}` : `Branch: ${mermaidLabel(d.label)}`;
    return `    ${mermaidId(nodeId)}{"${label}"}`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as IfElseNodeData;
    return [`#### Branch: ${d.label || d.name}`, "", `- **Expression:** ${d.expression || "_not set_"}`].join("\n");
  },
};
import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SubAgentFlowNodeData } from "./types";
export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentFlowNodeData;
    return `    ${mermaidId(nodeId)}["Sub Workflow: ${mermaidLabel(d.flowRef || d.label)}"]`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentFlowNodeData;
    return [
      `#### Sub Workflow: ${d.label || d.name}`,
      "",
      `- **Flow Reference:** ${d.flowRef || "_not set_"}`,
      `- **Node Count:** ${d.nodeCount}`,
    ].join("\n");
  },
};
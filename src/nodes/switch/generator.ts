import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SwitchNodeData } from "./types";
export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SwitchNodeData;
    const expr = d.switchExpr;
    const label = expr ? `Switch: ${mermaidLabel(expr)}` : `Switch: ${mermaidLabel(d.label)}`;
    return `    ${mermaidId(nodeId)}{"${label}"}`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SwitchNodeData;
    const caseList = d.cases.map((c) => `  - ${c}`).join("\n");
    return [`#### Switch: ${d.label || d.name}`, "", `- **Expression:** ${d.switchExpr || "_not set_"}`, `- **Cases:**`, caseList].join("\n");
  },
};
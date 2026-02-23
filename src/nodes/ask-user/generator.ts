import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { AskUserNodeData } from "./types";
export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as AskUserNodeData;
    const q = d.questionText;
    const label = q ? `AskUserQuestion: ${mermaidLabel(q)}` : `AskUserQuestion: ${mermaidLabel(d.label)}`;
    return `    ${mermaidId(nodeId)}{"${label}"}`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as AskUserNodeData;
    const optList = d.options.map((o) => `  - ${o}`).join("\n");
    return [`#### AskUserQuestion: ${d.label || d.name}`, "", `- **Question:** ${d.questionText || "_not set_"}`, `- **Options:**`, optList].join("\n");
  },
};
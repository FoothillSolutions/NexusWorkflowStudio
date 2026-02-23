import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SkillNodeData } from "./types";
export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SkillNodeData;
    return `    ${mermaidId(nodeId)}["Skill: ${mermaidLabel(d.skillName || d.label)}"]`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SkillNodeData;
    return [`#### Skill: ${d.label || d.name}`, "", `- **Skill Name:** ${d.skillName || "_not set_"}`, `- **Project:** ${d.projectName || "_not set_"}`].join("\n");
  },
};
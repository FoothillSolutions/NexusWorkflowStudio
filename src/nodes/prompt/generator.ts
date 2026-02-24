import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { PromptNodeData } from "./types";
export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as PromptNodeData;
    return `    ${mermaidId(nodeId)}["${mermaidLabel(d.label || d.name)}"]`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as PromptNodeData;
    const safeId = mermaidId(nodeId);
    return [
      `#### ${safeId}`,
      "",
      "```md",
      d.promptText ?? "",
      "```",
    ].join("\n");
  },
};
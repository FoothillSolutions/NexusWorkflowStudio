import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import { getScriptMarkdownFenceLanguage } from "@/nodes/skill/script-utils";
import type { ScriptNodeData } from "./types";

export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as ScriptNodeData;
    return `    ${mermaidId(nodeId)}["Script: ${mermaidLabel(d.label || d.name)}"]`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as ScriptNodeData;
    const safeId = mermaidId(nodeId);
    const fenceLanguage = getScriptMarkdownFenceLanguage(d);
    return [
      `#### ${safeId}(Script: ${d.label || d.name})`,
      "",
      `\`\`\`${fenceLanguage}`,
      d.promptText ?? "",
      "```",
    ].join("\n");
  },
};


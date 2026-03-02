import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { DocumentNodeData } from "./types";

function buildDocFile(docName: string, ext: string, d: DocumentNodeData): string {
  const content = d.contentMode === "linked" ? d.linkedFileContent?.trim() || "" : d.contentText?.trim() || "";
  return content + "\n";
}

export const generator: NodeGeneratorModule & {
  getDocFile?(nodeId: string, data: WorkflowNodeData): { path: string; content: string } | null;
} = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as DocumentNodeData;
    return `    ${mermaidId(nodeId)}["Doc: ${mermaidLabel(d.docName || d.label)}"]`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as DocumentNodeData;
    return [
      `#### Document: ${d.label || d.docName || d.name}`,
      "",
      `- **Doc Name:** ${d.docName || "_not set_"}`,
      `- **Type:** ${d.fileExtension || "md"}`,
      `- **Source:** ${d.contentMode === "linked" ? `linked (${d.linkedFileName || "none"})` : "inline"}`,
    ].join("\n");
  },

  getDocFile(_nodeId: string, data: WorkflowNodeData) {
    const d = data as DocumentNodeData;
    const docName = d.docName?.trim();
    if (!docName) return null;
    const ext = d.fileExtension || "md";
    return {
      path: `.opencode/docs/${docName}.${ext}`,
      content: buildDocFile(docName, ext, d),
    };
  },
};


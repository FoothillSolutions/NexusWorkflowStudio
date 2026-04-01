import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import {
  buildGeneratedDocsFilePath,
  DEFAULT_GENERATION_TARGET,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import type { DocumentNodeData } from "./types";
import { getDocumentRelativePath } from "./utils";

function buildDocFile(d: DocumentNodeData): string {
  const content = d.contentMode === "linked"
    ? d.linkedFileContent?.trim() || ""
    : d.contentText?.trim() || "";
  return content + "\n";
}

export const generator: NodeGeneratorModule & {
  getDocFile?(
    nodeId: string,
    data: WorkflowNodeData,
    target?: GenerationTargetId,
  ): { path: string; content: string } | null;
} = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as DocumentNodeData;
    return `    ${mermaidId(nodeId)}["Doc: ${mermaidLabel(d.docName || d.label)}"]`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as DocumentNodeData;
    const relativePath = getDocumentRelativePath(d);
    return [
      `#### Document: ${d.label || d.docName || d.name}`,
      "",
      `- **Doc Name:** ${d.docName || "_not set_"}`,
      `- **Subfolder:** ${d.docSubfolder || "_root docs_"}`,
      `- **Path:** ${relativePath ? `docs/${relativePath}` : "_not set_"}`,
      `- **Type:** ${d.fileExtension || "md"}`,
      `- **Source:** ${d.contentMode === "linked" ? `linked (${d.linkedFileName ?? "none"})` : "inline"}`,
    ].join("\n");
  },

  getDocFile(
    _nodeId: string,
    data: WorkflowNodeData,
    target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
  ) {
    const d = data as DocumentNodeData;
    const relativePath = getDocumentRelativePath(d);
    if (!relativePath) return null;
    return {
      path: buildGeneratedDocsFilePath(relativePath, target),
      content: buildDocFile(d),
    };
  },
};


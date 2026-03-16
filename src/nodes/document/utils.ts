import type { DocumentNodeData } from "./types";
import type { SubWorkflowNodeData, WorkflowNode } from "@/types/workflow";

export const DOC_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const DOC_SUBFOLDER_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function normalizeDocSubfolder(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getDocumentRelativePath(
  data: Pick<DocumentNodeData, "docName" | "fileExtension" | "docSubfolder">,
): string | null {
  const docName = data.docName?.trim();
  if (!docName) return null;

  const fileName = `${docName}.${data.fileExtension || "md"}`;
  const subfolder = data.docSubfolder?.trim();
  return subfolder ? `${subfolder}/${fileName}` : fileName;
}

export function getDocumentDisplayPath(
  data: Pick<DocumentNodeData, "docName" | "fileExtension" | "docSubfolder">,
): string {
  const existingPath = getDocumentRelativePath(data);
  if (existingPath) return existingPath;

  const fallbackFileName = `untitled.${data.fileExtension || "md"}`;
  const subfolder = data.docSubfolder?.trim();
  return subfolder ? `${subfolder}/${fallbackFileName}` : fallbackFileName;
}

export function collectDocumentSubfolders(nodes: WorkflowNode[]): string[] {
  const folders = new Set<string>();

  const visit = (workflowNodes: WorkflowNode[]) => {
    for (const node of workflowNodes) {
      if (node.data?.type === "document") {
        const subfolder = (node.data as DocumentNodeData).docSubfolder?.trim();
        if (subfolder) folders.add(subfolder);
        continue;
      }

      if (node.data?.type === "sub-workflow") {
        const subWorkflowData = node.data as SubWorkflowNodeData;
        visit(subWorkflowData.subNodes ?? []);
      }
    }
  };

  visit(nodes);

  return [...folders].sort((a, b) => a.localeCompare(b));
}
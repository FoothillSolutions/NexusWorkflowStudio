import type { NodeType } from "@/types/workflow";

export type DocumentContentMode = "inline" | "linked";

export interface DocumentNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "document">;
  label: string;
  name: string;
  docName: string;
  docSubfolder: string;
  contentMode: DocumentContentMode;
  fileExtension: "md" | "txt" | "json" | "yaml";
  contentText: string;
  linkedFileName: string;
  linkedFileContent: string;
  description: string;
}
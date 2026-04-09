import { WorkflowNodeType } from "@/types/workflow";

export type DocumentContentMode = "inline" | "linked" | "brain";

export interface DocumentNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.Document;
  label: string;
  name: string;
  docName: string;
  docSubfolder: string;
  contentMode: DocumentContentMode;
  fileExtension: "md" | "txt" | "json" | "yaml";
  contentText: string;
  linkedFileName: string | null;
  linkedFileContent: string | null;
  description: string;
  /** Brain doc ID when contentMode is "brain" */
  brainDocId: string | null;
}

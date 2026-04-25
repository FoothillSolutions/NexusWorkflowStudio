import { WorkflowNodeType } from "@/types/workflow";
export interface PromptNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.Prompt;
  label: string;
  name: string;
  promptText: string;
  detectedVariables: string[];
  /** Brain doc ID when prompt content is sourced from the Brain library */
  brainDocId: string | null;
}

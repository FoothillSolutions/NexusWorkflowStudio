import { WorkflowNodeType } from "@/types/workflow";
export interface PromptNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.Prompt;
  label: string;
  name: string;
  promptText: string;
  detectedVariables: string[];
}

import { WorkflowNodeType } from "@/types/workflow";

export interface ScriptNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.Script;
  label: string;
  name: string;
  promptText: string;
  detectedVariables: string[];
}


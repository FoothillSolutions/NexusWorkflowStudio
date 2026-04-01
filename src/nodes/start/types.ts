import { WorkflowNodeType } from "@/types/workflow";

export interface StartNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.Start;
  label: string;
  name: string;
}

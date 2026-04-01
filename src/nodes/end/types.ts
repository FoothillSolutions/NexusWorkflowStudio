import { WorkflowNodeType } from "@/types/workflow";
export interface EndNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.End;
  label: string;
  name: string;
}

import { WorkflowNodeType } from "@/types/workflow";

export interface SwitchBranch {
  label: string;
  condition: string;
}

export interface SwitchNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.Switch;
  label: string;
  name: string;
  evaluationTarget: string;
  branches: SwitchBranch[];
}

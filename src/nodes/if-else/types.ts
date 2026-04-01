import { WorkflowNodeType } from "@/types/workflow";

export interface IfElseBranch {
  label: string;
  condition: string;
}

export interface IfElseNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.IfElse;
  label: string;
  name: string;
  evaluationTarget: string;
  branches: IfElseBranch[];
}

import { WorkflowNodeType } from "@/types/workflow";

export interface AskUserOption {
  label: string;
  description: string;
}

export interface AskUserNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.AskUser;
  label: string;
  name: string;
  questionText: string;
  multipleSelection: boolean;
  aiSuggestOptions: boolean;
  options: AskUserOption[];
}

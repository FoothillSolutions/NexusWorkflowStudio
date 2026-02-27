import type { NodeType } from "@/types/workflow";

export interface AskUserOption {
  label: string;
  description: string;
}

export interface AskUserNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "ask-user">;
  label: string;
  name: string;
  questionText: string;
  multipleSelection: boolean;
  aiSuggestOptions: boolean;
  options: AskUserOption[];
}
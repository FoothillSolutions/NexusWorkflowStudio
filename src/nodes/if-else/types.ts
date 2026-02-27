import type { NodeType } from "@/types/workflow";

export interface IfElseBranch {
  label: string;
  condition: string;
}

export interface IfElseNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "if-else">;
  label: string;
  name: string;
  evaluationTarget: string;
  branches: IfElseBranch[];
}
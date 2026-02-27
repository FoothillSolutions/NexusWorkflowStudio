import type { NodeType } from "@/types/workflow";

export interface SwitchBranch {
  label: string;
  condition: string;
}

export interface SwitchNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "switch">;
  label: string;
  name: string;
  evaluationTarget: string;
  branches: SwitchBranch[];
}
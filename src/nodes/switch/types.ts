import type { NodeType } from "@/types/workflow";
export interface SwitchNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "switch">;
  label: string; name: string; switchExpr: string; cases: string[];
}
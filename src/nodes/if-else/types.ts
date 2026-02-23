import type { NodeType } from "@/types/workflow";
export interface IfElseNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "if-else">;
  label: string; name: string; expression: string;
}
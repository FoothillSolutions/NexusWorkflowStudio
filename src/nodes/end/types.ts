import type { NodeType } from "@/types/workflow";
export interface EndNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "end">;
  label: string;
  name: string;
}
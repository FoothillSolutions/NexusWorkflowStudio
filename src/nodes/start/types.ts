import type { NodeType } from "@/types/workflow";

export interface StartNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "start">;
  label: string;
  name: string;
}

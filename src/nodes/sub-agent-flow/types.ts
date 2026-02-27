import type { NodeType } from "@/types/workflow";
export interface SubAgentFlowNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "sub-workflow">;
  label: string;
  name: string;
  flowRef: string;
  nodeCount: number;
}
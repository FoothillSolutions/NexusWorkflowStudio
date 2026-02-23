import type { NodeType } from "@/types/workflow";
export interface SubAgentFlowNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "sub-agent-flow">;
  label: string;
  name: string;
  flowRef: string;
  nodeCount: number;
}
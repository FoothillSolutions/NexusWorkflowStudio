import { WorkflowNodeType } from "@/types/workflow";
export interface McpToolNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.McpTool;
  label: string; name: string; toolName: string; paramsText: string;
}

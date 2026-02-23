import type { NodeType } from "@/types/workflow";
export interface McpToolNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "mcp-tool">;
  label: string; name: string; toolName: string; paramsText: string;
}
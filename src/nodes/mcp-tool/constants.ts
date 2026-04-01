import { Plug } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { McpToolNodeData } from "./types";
export const mcpToolRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.McpTool, displayName: "MCP Tool", description: "Call an MCP tool",
  icon: Plug, accentColor: "teal", accentHex: NODE_ACCENT["mcp-tool"], category: NodeCategory.Basic,
  defaultData: (): McpToolNodeData => ({ type: WorkflowNodeType.McpTool, label: "MCP Tool", name: "", toolName: "", paramsText: "" }),
};
export const mcpToolSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  toolName: z.string(), paramsText: z.string(),
});

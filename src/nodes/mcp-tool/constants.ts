import { Plug } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { McpToolNodeData } from "./types";
export const mcpToolRegistryEntry: NodeRegistryEntry = {
  type: "mcp-tool", displayName: "MCP Tool", description: "Call an MCP tool",
  icon: Plug, accentColor: "teal", accentHex: "#14b8a6", category: NodeCategory.Basic,
  defaultData: (): McpToolNodeData => ({ type: "mcp-tool", label: "MCP Tool", name: "", toolName: "", paramsText: "" }),
};
export const mcpToolSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  toolName: z.string(), paramsText: z.string(),
});
import type { NodeType } from "@/types/workflow";
export interface AskUserNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "ask-user">;
  label: string; name: string; questionText: string; options: string[];
}
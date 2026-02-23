import type { NodeType } from "@/types/workflow";
export interface PromptNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "prompt">;
  label: string;
  name: string;
  promptText: string;
  detectedVariables: string[];
}
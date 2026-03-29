import type { NodeType } from "@/types/workflow";

export interface ScriptNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "script">;
  label: string;
  name: string;
  promptText: string;
  detectedVariables: string[];
}


import type { NodeType } from "@/types/workflow";
export { SubAgentModel, SubAgentMemory } from "./enums";
import type { SubAgentModel, SubAgentMemory } from "./enums";

export interface SubAgentNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "sub-agent">;
  label: string;
  name: string;
  promptText: string;
  detectedVariables: string[];
  model: SubAgentModel;
  memory: SubAgentMemory;
  tools: string;
}
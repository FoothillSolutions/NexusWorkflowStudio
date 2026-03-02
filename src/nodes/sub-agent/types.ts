import type { NodeType } from "@/types/workflow";
export { SubAgentModel, SubAgentMemory, MODEL_DISPLAY_NAMES, MODEL_COST_MULTIPLIER } from "./enums";
import type { SubAgentModel, SubAgentMemory } from "./enums";

export interface SubAgentNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "agent">;
  label: string;
  name: string;
  description: string;
  promptText: string;
  detectedVariables: string[];
  model: SubAgentModel;
  memory: SubAgentMemory;
  temperature: number;
  color: string;
  /** List of tool names that are DISABLED (empty = all enabled) */
  disabledTools: string[];
  /** Positional parameter mappings passed to the delegated agent ($1→agent $1, etc.) */
  parameterMappings: string[];
  /** Static variable mappings: {{varName}} → resource ref (e.g. "doc:api-guide.md", "skill:my-skill") */
  variableMappings: Record<string, string>;
}


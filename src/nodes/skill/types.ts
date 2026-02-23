import type { NodeType } from "@/types/workflow";
export interface SkillNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "skill">;
  label: string; name: string; skillName: string; projectName: string;
}
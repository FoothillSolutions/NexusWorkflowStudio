import { WorkflowNodeType } from "@/types/workflow";

export interface SkillMetadataEntry {
  key: string;
  value: string;
}

export interface SkillNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.Skill;
  label: string;
  name: string;
  skillName: string;
  description: string;
  promptText: string;
  detectedVariables: string[];
  variableMappings: Record<string, string>;
  metadata: SkillMetadataEntry[];
}

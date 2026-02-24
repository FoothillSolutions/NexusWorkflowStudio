import type { NodeType } from "@/types/workflow";

export interface SkillMetadataEntry {
  key: string;
  value: string;
}

export interface SkillNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "skill">;
  label: string;
  name: string;
  skillName: string;
  projectName: string;
  description: string;
  promptText: string;
  detectedVariables: string[];
  metadata: SkillMetadataEntry[];
}
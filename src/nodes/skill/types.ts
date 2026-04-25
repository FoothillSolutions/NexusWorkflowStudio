import { WorkflowNodeType } from "@/types/workflow";
import type { LibraryScope } from "@/types/library";

export interface SkillMetadataEntry {
  key: string;
  value: string;
}

export interface SkillLibraryRef {
  scope: LibraryScope;
  packId: string;
  packKey?: string;
  packVersion: string | "draft";
  skillId: string;
  skillKey?: string;
  skillName?: string;
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
  libraryRef?: SkillLibraryRef | null;
}

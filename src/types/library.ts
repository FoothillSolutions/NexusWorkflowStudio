export type LibraryScope = "workspace" | "user";

export type DocumentRole =
  | "skill-entrypoint"
  | "reference"
  | "doc"
  | "rule"
  | "template"
  | "example"
  | "asset"
  | "script"
  | "manifest";

export interface PackRef {
  scope: LibraryScope;
  packId: string;
  packKey: string;
  packVersion: string | "draft";
}

export interface SkillRef {
  scope: LibraryScope;
  packId: string;
  packVersion: string | "draft";
  skillId: string;
}

export interface SkillBundleDocument {
  docId: string;
  path: string;
  role: DocumentRole;
  content: string;
  contentHash: string;
}

export interface SkillBundle {
  scope: LibraryScope;
  packId: string;
  packKey: string;
  packVersion: string;
  skillId: string;
  skillKey: string;
  skillName: string;
  description: string;
  entrypoint: SkillBundleDocument;
  documents: SkillBundleDocument[];
  manifestHash: string;
}

export interface ValidationWarning {
  level: "warning" | "error";
  code: string;
  message: string;
  path?: string;
  docId?: string;
  skillId?: string;
}

export type MergeState = "clean" | "conflict" | "resolved";

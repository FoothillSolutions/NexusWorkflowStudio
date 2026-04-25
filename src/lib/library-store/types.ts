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

export interface LibraryRecord {
  id: string;
  workspaceId: string;
  scope: LibraryScope;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PackRecord {
  id: string;
  libraryId: string;
  packKey: string;
  name: string;
  description: string;
  tags: string[];
  basePackId: string | null;
  external: boolean;
  currentBranchId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  metadata?: Record<string, unknown>;
}

export interface SkillRecord {
  id: string;
  packId: string;
  skillKey: string;
  name: string;
  description: string;
  entrypointDocId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deprecated: boolean;
  metadata?: Record<string, unknown>;
}

export interface LibraryDocumentRecord {
  id: string;
  packId: string;
  role: DocumentRole;
  path: string;
  currentVersionId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  metadata?: Record<string, unknown>;
}

export interface LibraryDocumentVersionRecord {
  id: string;
  docId: string;
  packId: string;
  parentVersionId: string | null;
  contentKey: string;
  contentHash: string;
  byteLength: number;
  message: string;
  createdBy: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface PackVersionRecord {
  id: string;
  packId: string;
  version: string;
  manifestKey: string;
  manifestHash: string;
  createdBy: string;
  createdAt: string;
  deprecated: boolean;
  deletedAt: string | null;
  notes: string;
}

export interface PackVersionDocumentRecord {
  id: string;
  packVersionId: string;
  packId: string;
  docId: string;
  versionId: string;
  role: DocumentRole;
  path: string;
  contentHash: string;
}

export interface SkillVersionRecord {
  id: string;
  skillId: string;
  packId: string;
  version: string;
  packVersionId: string | null;
  createdBy: string;
  createdAt: string;
  deprecated: boolean;
  deletedAt: string | null;
  notes: string;
}

export interface SkillVersionDocumentRecord {
  id: string;
  skillVersionId: string;
  skillId: string;
  docId: string;
  versionId: string;
  contentHash: string;
}

export interface BranchRecord {
  id: string;
  packId: string;
  name: string;
  baseVersionByDocId: Record<string, string>;
  headVersionByDocId: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictRecord {
  id: string;
  mergeId: string;
  packId: string;
  docId: string;
  conflictType: "text_conflict" | "delete_edit" | "add_add";
  ancestorContent: string | null;
  baseContent: string | null;
  branchContent: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionContent: string | null;
}

export interface MergeRecord {
  id: string;
  packId: string;
  branchId: string;
  basePackVersionId: string | null;
  initiatedBy: string;
  initiatedAt: string;
  status: "clean" | "conflict" | "resolved";
  mergedCleanlyDocs: string[];
  conflictDocs: string[];
  completedAt: string | null;
}

export interface LibraryManifest {
  version: 1;
  libraries: LibraryRecord[];
  packs: PackRecord[];
  skills: SkillRecord[];
  documents: LibraryDocumentRecord[];
  versions: LibraryDocumentVersionRecord[];
  packVersions: PackVersionRecord[];
  packVersionDocuments: PackVersionDocumentRecord[];
  skillVersions: SkillVersionRecord[];
  skillVersionDocuments: SkillVersionDocumentRecord[];
  branches: BranchRecord[];
  merges: MergeRecord[];
  conflicts: ConflictRecord[];
}

export interface CreatePackInput {
  packKey: string;
  name: string;
  description?: string;
  tags?: string[];
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDocumentInput {
  role: DocumentRole;
  path: string;
  content: string;
  createdBy?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface SaveDocumentVersionInput {
  content: string;
  previousVersionId: string | null;
  message?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSkillInput {
  skillKey: string;
  name: string;
  description: string;
  entrypointDocId: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface PublishPackVersionInput {
  version: string;
  notes?: string;
  createdBy?: string;
}

export interface PublishSkillVersionInput {
  version: string;
  notes?: string;
  createdBy?: string;
  linkToLatestPackVersion?: boolean;
}

export interface ResolveLiveInput {
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

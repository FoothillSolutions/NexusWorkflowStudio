import type {
  KnowledgeDoc,
  KnowledgeDocVersion,
  KnowledgeFeedback,
  KnowledgeVersionReason,
  KnowledgeMetrics,
} from "@/types/knowledge";

export interface BrainWorkspaceRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrainDocumentRecord extends KnowledgeDoc {
  workspaceId: string;
  deletedAt: string | null;
}

export interface BrainDocumentVersionRecord extends KnowledgeDocVersion {
  workspaceId: string;
  snapshotKey: string;
}

export interface BrainFeedbackRecord extends KnowledgeFeedback {
  workspaceId: string;
  docId: string;
}

export interface BrainManifest {
  version: 1;
  workspaces: BrainWorkspaceRecord[];
  documents: BrainDocumentRecord[];
  versions: BrainDocumentVersionRecord[];
  feedback: BrainFeedbackRecord[];
}

export interface SaveBrainDocInput {
  id?: string;
  title: string;
  summary: string;
  content: string;
  docType: KnowledgeDoc["docType"];
  status: KnowledgeDoc["status"];
  createdBy: string;
  tags: string[];
  associatedWorkflowIds: string[];
  createdAt?: string;
  updatedAt?: string;
  metrics?: KnowledgeMetrics;
  versionReason?: KnowledgeVersionReason;
}

export interface CreateVersionInput {
  reason: KnowledgeVersionReason;
  createdBy: string;
  summary: string;
}

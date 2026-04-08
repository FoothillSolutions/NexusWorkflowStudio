export type KnowledgeDocType = "note" | "summary" | "runbook" | "guide" | "data";
export type KnowledgeDocStatus = "draft" | "active" | "archived";
export type FeedbackRating = "success" | "failure" | "neutral";

export interface KnowledgeFeedback {
  id: string;
  rating: FeedbackRating;
  note: string;
  author: string;
  at: string; // ISO timestamp
}

export interface KnowledgeMetrics {
  views: number;
  lastViewedAt: string | null;
  feedback: KnowledgeFeedback[];
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  summary: string;
  content: string;
  docType: KnowledgeDocType;
  tags: string[];
  associatedWorkflowIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: KnowledgeDocStatus;
  metrics: KnowledgeMetrics;
}

export interface KnowledgeBrain {
  version: "1";
  exportedAt: string;
  docs: KnowledgeDoc[];
}

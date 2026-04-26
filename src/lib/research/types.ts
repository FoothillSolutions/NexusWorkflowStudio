export type ResearchTemplateId = "research-brief" | "prd" | "implementation-plan" | "decision-log";
export type ResearchViewMode = "tiling" | "kanban" | "graph";
export type ResearchContentType = "claim" | "quote" | "source" | "task" | "question" | "decision" | "note";

export interface ResearchSource {
  id: string;
  title: string;
  url?: string;
  excerpt?: string;
}

export interface ResearchTask {
  id: string;
  text: string;
  done: boolean;
}

export interface ResearchEnrichmentResult {
  contentType: ResearchContentType;
  category: string;
  annotation: string;
  confidence: number;
  influencedByIndices: number[];
  influencedByBlockIds?: string[];
  isUnrelated: boolean;
  mergeWithIndex: number | null;
  mergeWithBlockId?: string | null;
  sources?: ResearchSource[];
}

export interface ResearchBlock {
  id: string;
  content: string;
  contentType: ResearchContentType;
  category: string;
  annotation: string;
  confidence: number;
  influencedByBlockIds: string[];
  isUnrelated: boolean;
  mergeWithBlockId: string | null;
  sources: ResearchSource[];
  tasks: ResearchTask[];
  pinned: boolean;
  collapsed: boolean;
  aiError?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

export interface ResearchGhostNote {
  id: string;
  text: string;
  suggestedBlockIds: string[];
  createdAt: string;
}

export interface ResearchSynthesis {
  id: string;
  title: string;
  content: string;
  sourceBlockIds: string[];
  createdAt: string;
  createdBy: string;
}

export interface ResearchSpaceRecord {
  id: string;
  workspaceId: string;
  name: string;
  templateId: ResearchTemplateId | null;
  blockCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
  associatedWorkflowIds: string[];
}

export interface ResearchSpaceData {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
  blocks: ResearchBlock[];
  collapsedIds: string[];
  ghostNotes: ResearchGhostNote[];
  syntheses: ResearchSynthesis[];
  templateId: ResearchTemplateId | null;
  associatedWorkflowIds: string[];
  viewMode: ResearchViewMode;
  selectedBlockIds: string[];
}

export interface ResearchManifest {
  version: 1;
  workspaceId: string;
  spaces: ResearchSpaceRecord[];
  updatedAt: string;
}

export interface ResearchPromoteInput {
  target?: "workspace" | "personal";
  blockIds?: string[];
  synthesisIds?: string[];
  taskIds?: string[];
  sourceIds?: string[];
  associatedWorkflowIds?: string[];
  createdBy?: string;
}

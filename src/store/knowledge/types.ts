import type {
  KnowledgeDoc,
  KnowledgeDocVersion,
  KnowledgeDocType,
  KnowledgeDocStatus,
  FeedbackRating,
} from "@/types/knowledge";

export interface KnowledgeState {
  docs: KnowledgeDoc[];
  docVersions: Record<string, KnowledgeDocVersion[]>;
  panelOpen: boolean;
  editorOpen: boolean;
  editingDocId: string | null; // null = new doc
  searchQuery: string;
  activeDocType: KnowledgeDocType | "all";
  activeStatus: KnowledgeDocStatus | "all";
  loading: boolean;
  saving: boolean;
  restoringVersionId: string | null;

  refresh: () => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  openEditor: (docId?: string) => void;
  closeEditor: () => void;
  saveDoc: (partial: Partial<KnowledgeDoc> & { title: string }) => Promise<string>;
  deleteDoc: (id: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActiveDocType: (t: KnowledgeDocType | "all") => void;
  setActiveStatus: (s: KnowledgeDocStatus | "all") => void;
  recordView: (id: string) => Promise<void>;
  addFeedback: (
    id: string,
    rating: FeedbackRating,
    note: string,
    author: string,
  ) => Promise<void>;
  exportBrain: () => void;
  importBrain: (file: File) => Promise<void>;
  loadVersions: (docId: string) => Promise<void>;
  restoreVersion: (docId: string, versionId: string) => Promise<void>;
}

import type {
  KnowledgeDoc,
  KnowledgeDocType,
  KnowledgeDocStatus,
  FeedbackRating,
} from "@/types/knowledge";

export interface KnowledgeState {
  docs: KnowledgeDoc[];
  panelOpen: boolean;
  editorOpen: boolean;
  editingDocId: string | null; // null = new doc
  searchQuery: string;
  activeDocType: KnowledgeDocType | "all";
  activeStatus: KnowledgeDocStatus | "all";

  refresh: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  openEditor: (docId?: string) => void;
  closeEditor: () => void;
  saveDoc: (partial: Partial<KnowledgeDoc> & { title: string }) => string;
  deleteDoc: (id: string) => void;
  setSearchQuery: (q: string) => void;
  setActiveDocType: (t: KnowledgeDocType | "all") => void;
  setActiveStatus: (s: KnowledgeDocStatus | "all") => void;
  recordView: (id: string) => void;
  addFeedback: (
    id: string,
    rating: FeedbackRating,
    note: string,
    author: string,
  ) => void;
  exportBrain: () => void;
  importBrain: (file: File) => Promise<void>;
}

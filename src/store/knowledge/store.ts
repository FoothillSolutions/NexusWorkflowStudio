import { create } from "zustand";
import { customAlphabet } from "nanoid";
import type { KnowledgeState } from "./types";
import type { KnowledgeDoc, FeedbackRating } from "@/types/knowledge";
import {
  getAllKnowledgeDocs,
  saveKnowledgeDoc,
  deleteKnowledgeDoc,
  incrementDocView,
  addDocFeedback,
  exportBrainFile,
  parseBrainImport,
  mergeBrainImport,
} from "@/lib/knowledge";
import { useSavedWorkflowsStore } from "@/store/library";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  docs: [],
  panelOpen: false,
  editorOpen: false,
  editingDocId: null,
  searchQuery: "",
  activeDocType: "all",
  activeStatus: "all",

  refresh: () => {
    set({ docs: getAllKnowledgeDocs() });
  },

  openPanel: () => {
    // Mutual exclusion: close library panel when opening brain
    useSavedWorkflowsStore.getState().closeSidebar();
    get().refresh();
    set({ panelOpen: true });
  },

  closePanel: () => set({ panelOpen: false }),

  togglePanel: () => {
    if (get().panelOpen) {
      get().closePanel();
    } else {
      get().openPanel();
    }
  },

  openEditor: (docId?: string) => {
    set({ editingDocId: docId ?? null, editorOpen: true });
    if (docId) {
      incrementDocView(docId);
      get().refresh();
    }
  },

  closeEditor: () => set({ editorOpen: false, editingDocId: null }),

  saveDoc: (partial) => {
    const now = new Date().toISOString();
    const existing = partial.id ? get().docs.find((d) => d.id === partial.id) : null;

    const doc: KnowledgeDoc = {
      id: existing?.id ?? nanoid(),
      title: partial.title,
      summary: partial.summary ?? "",
      content: partial.content ?? "",
      docType: partial.docType ?? "note",
      tags: partial.tags ?? [],
      associatedWorkflowIds: partial.associatedWorkflowIds ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdBy: partial.createdBy ?? "",
      status: partial.status ?? "draft",
      metrics: existing?.metrics ?? { views: 0, lastViewedAt: null, feedback: [] },
    };

    saveKnowledgeDoc(doc);
    get().refresh();
    return doc.id;
  },

  deleteDoc: (id) => {
    deleteKnowledgeDoc(id);
    get().refresh();
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveDocType: (t) => set({ activeDocType: t }),
  setActiveStatus: (s) => set({ activeStatus: s }),

  recordView: (id) => {
    incrementDocView(id);
    get().refresh();
  },

  addFeedback: (id, rating: FeedbackRating, note, author) => {
    addDocFeedback(id, {
      id: nanoid(),
      rating,
      note,
      author,
      at: new Date().toISOString(),
    });
    get().refresh();
  },

  exportBrain: () => {
    exportBrainFile();
  },

  importBrain: async (file) => {
    const brain = await parseBrainImport(file);
    mergeBrainImport(brain);
    get().refresh();
  },
}));

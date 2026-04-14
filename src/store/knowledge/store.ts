import { create } from "zustand";
import { customAlphabet } from "nanoid";
import type { KnowledgeState } from "./types";
import type { FeedbackRating } from "@/types/knowledge";
import {
  exportBrainFile,
  parseBrainImport,
  replaceAllKnowledgeDocs,
} from "@/lib/knowledge";
import {
  addBrainDocFeedback,
  deleteBrainDoc,
  fetchBrainDocs,
  fetchBrainDocVersions,
  recordBrainDocView,
  restoreBrainDocVersion,
  saveBrainDoc,
} from "@/lib/brain/client";
import { useSavedWorkflowsStore } from "@/store/library";
import { useWorkflowStore } from "@/store/workflow";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  docs: [],
  docVersions: {},
  panelOpen: false,
  editorOpen: false,
  editingDocId: null,
  searchQuery: "",
  activeDocType: "all",
  activeStatus: "all",
  loading: false,
  saving: false,
  restoringVersionId: null,

  refresh: async () => {
    set({ loading: true });
    try {
      const docs = await fetchBrainDocs();
      set({ docs });
    } finally {
      set({ loading: false });
    }
  },

  openPanel: () => {
    // Mutual exclusion: close library panel when opening brain
    useSavedWorkflowsStore.getState().closeSidebar();
    useWorkflowStore.getState().closePropertiesPanel();
    void get().refresh().catch(() => {});
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
      void get().recordView(docId);
      void get().loadVersions(docId);
    }
  },

  closeEditor: () => set({ editorOpen: false, editingDocId: null }),

  saveDoc: async (partial) => {
    const existing = partial.id ? get().docs.find((d) => d.id === partial.id) : null;

    set({ saving: true });
    try {
      const doc = await saveBrainDoc({
        id: existing?.id ?? partial.id,
        title: partial.title,
        summary: partial.summary ?? "",
        content: partial.content ?? "",
        docType: partial.docType ?? "note",
        tags: partial.tags ?? [],
        associatedWorkflowIds: partial.associatedWorkflowIds ?? [],
        createdBy: partial.createdBy ?? existing?.createdBy ?? "",
        status: partial.status ?? "draft",
      });

      const docs = [doc, ...get().docs.filter((item) => item.id !== doc.id)];
      replaceAllKnowledgeDocs(docs);
      set({ docs });
      await get().loadVersions(doc.id);
      return doc.id;
    } finally {
      set({ saving: false });
    }
  },

  deleteDoc: async (id) => {
    await deleteBrainDoc(id);
    const docs = get().docs.filter((doc) => doc.id !== id);
    replaceAllKnowledgeDocs(docs);
    set({ docs });
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveDocType: (t) => set({ activeDocType: t }),
  setActiveStatus: (s) => set({ activeStatus: s }),

  recordView: async (id) => {
    const doc = await recordBrainDocView(id);
    const docs = get().docs.map((item) => (item.id === id ? doc : item));
    replaceAllKnowledgeDocs(docs);
    set({ docs });
  },

  addFeedback: async (id, rating: FeedbackRating, note, author) => {
    const doc = await addBrainDocFeedback(id, {
      id: nanoid(),
      rating,
      note,
      author,
      at: new Date().toISOString(),
    });
    const docs = get().docs.map((item) => (item.id === id ? doc : item));
    replaceAllKnowledgeDocs(docs);
    set({ docs });
  },

  exportBrain: () => {
    exportBrainFile();
  },

  importBrain: async (file) => {
    const brain = await parseBrainImport(file);
    set({ saving: true });
    try {
      for (const doc of brain.docs) {
        await saveBrainDoc(doc);
      }
      await get().refresh();
    } finally {
      set({ saving: false });
    }
  },

  loadVersions: async (docId) => {
    const versions = await fetchBrainDocVersions(docId);
    set((state) => ({
      docVersions: {
        ...state.docVersions,
        [docId]: versions,
      },
    }));
  },

  restoreVersion: async (docId, versionId) => {
    set({ restoringVersionId: versionId });
    try {
      const doc = await restoreBrainDocVersion(docId, versionId);
      const docs = [doc, ...get().docs.filter((item) => item.id !== doc.id)];
      replaceAllKnowledgeDocs(docs);
      set({ docs });
      await get().loadVersions(docId);
    } finally {
      set({ restoringVersionId: null });
    }
  },
}));

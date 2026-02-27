import { create } from "zustand";
import { customAlphabet } from "nanoid";
import type { SavedWorkflowEntry } from "@/lib/saved-workflows";
import {
  getAllSavedWorkflows,
  saveWorkflowToCollection,
  deleteFromCollection,
  loadFromCollection,
  renameInCollection,
  duplicateInCollection,
} from "@/lib/saved-workflows";
import type { WorkflowJSON } from "@/types/workflow";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

interface SavedWorkflowsState {
  entries: SavedWorkflowEntry[];
  sidebarOpen: boolean;
  refresh: () => void;
  save: (workflow: WorkflowJSON, existingId?: string) => string;
  remove: (id: string) => void;
  rename: (id: string, newName: string) => void;
  duplicate: (id: string) => string | null;
  load: (id: string) => WorkflowJSON | null;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
}

export const useSavedWorkflowsStore = create<SavedWorkflowsState>((set, get) => ({
  entries: [],
  sidebarOpen: false,

  refresh: () => {
    set({ entries: getAllSavedWorkflows() });
  },

  save: (workflow, existingId) => {
    const id = existingId ?? nanoid();
    saveWorkflowToCollection(id, workflow);
    get().refresh();
    return id;
  },

  remove: (id) => {
    deleteFromCollection(id);
    get().refresh();
  },

  rename: (id, newName) => {
    renameInCollection(id, newName);
    get().refresh();
  },

  duplicate: (id) => {
    const newId = nanoid();
    const result = duplicateInCollection(id, newId);
    if (result) {
      get().refresh();
      return newId;
    }
    return null;
  },

  load: (id) => {
    return loadFromCollection(id);
  },

  toggleSidebar: () => {
    const willOpen = !get().sidebarOpen;
    if (willOpen) get().refresh();
    set({ sidebarOpen: willOpen });
  },

  openSidebar: () => {
    get().refresh();
    set({ sidebarOpen: true });
  },

  closeSidebar: () => set({ sidebarOpen: false }),
}));


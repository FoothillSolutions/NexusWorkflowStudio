import { create } from "zustand";
import { customAlphabet } from "nanoid";
import type { SavedWorkflowEntry, LibraryItemEntry, LibraryCategory } from "@/lib/library";
import type {
  MarketplaceLibraryItem,
  MarketplaceWorkflowEntry,
} from "@/lib/marketplace/types";
import {
  getAllSavedWorkflows,
  saveWorkflowToCollection,
  deleteFromCollection,
  loadFromCollection,
  renameInCollection,
  duplicateInCollection,
  getAllLibraryItems,
  saveNodeToLibrary,
  deleteLibraryItem,
  renameLibraryItem,
} from "@/lib/library";
import type { WorkflowJSON, WorkflowNodeData } from "@/types/workflow";
import { useWorkflowStore } from "@/store/workflow";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
let marketplacePollTimer: ReturnType<typeof setTimeout> | null = null;

interface SavedWorkflowsState {
  entries: SavedWorkflowEntry[];
  libraryItems: LibraryItemEntry[];
  marketplaceItems: MarketplaceLibraryItem[];
  marketplaceWorkflows: MarketplaceWorkflowEntry[];
  marketplaceRefreshing: boolean;
  marketplaceError: string | null;
  activeCategory: LibraryCategory | "all";
  sidebarOpen: boolean;
  /** ID of the workflow currently being edited (null = unsaved / new) */
  activeId: string | null;
  refresh: () => void;
  save: (workflow: WorkflowJSON, existingId?: string) => string;
  remove: (id: string) => void;
  rename: (id: string, newName: string) => void;
  duplicate: (id: string) => string | null;
  load: (id: string) => WorkflowJSON | null;
  clearActiveId: () => void;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  setActiveCategory: (cat: LibraryCategory | "all") => void;
  saveNodeToLib: (nodeData: WorkflowNodeData) => string;
  removeLibraryItem: (id: string) => void;
  renameLibraryItem: (id: string, newName: string) => void;
  fetchMarketplaceItems: () => Promise<void>;
  refreshMarketplaces: () => Promise<void>;
}

export const useSavedWorkflowsStore = create<SavedWorkflowsState>((set, get) => ({
  entries: [],
  libraryItems: [],
  marketplaceItems: [],
  marketplaceWorkflows: [],
  marketplaceRefreshing: false,
  marketplaceError: null,
  activeCategory: "all",
  sidebarOpen: false,
  activeId: null,

  refresh: () => {
    set({
      entries: getAllSavedWorkflows(),
      libraryItems: getAllLibraryItems(),
    });
  },

  save: (workflow, existingId) => {
    // Reuse activeId when no explicit id is given (so "Save" updates the same entry)
    const id = existingId ?? get().activeId ?? nanoid();
    saveWorkflowToCollection(id, workflow);
    useWorkflowStore.getState().markWorkflowSaved(workflow);
    set({ activeId: id });
    get().refresh();
    return id;
  },

  remove: (id) => {
    deleteFromCollection(id);
    // Clear activeId if the deleted entry was the active one
    if (get().activeId === id) set({ activeId: null });
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
    const data = loadFromCollection(id);
    if (data) set({ activeId: id });
    return data;
  },

  clearActiveId: () => set({ activeId: null }),

  toggleSidebar: () => {
    const willOpen = !get().sidebarOpen;
    if (willOpen) {
      useWorkflowStore.getState().closePropertiesPanel();
      // Mutual exclusion: close brain panel when opening library
      import("@/store/knowledge").then(({ useKnowledgeStore }) => {
        useKnowledgeStore.getState().closePanel();
      });
      get().refresh();
      void get().fetchMarketplaceItems();
    }
    set({ sidebarOpen: willOpen });
  },

  openSidebar: () => {
    useWorkflowStore.getState().closePropertiesPanel();
    // Mutual exclusion: close brain panel when opening library
    import("@/store/knowledge").then(({ useKnowledgeStore }) => {
      useKnowledgeStore.getState().closePanel();
    });
    get().refresh();
    void get().fetchMarketplaceItems();
    set({ sidebarOpen: true });
  },

  closeSidebar: () => set({ sidebarOpen: false }),

  setActiveCategory: (cat) => set({ activeCategory: cat }),

  saveNodeToLib: (nodeData) => {
    const id = nanoid();
    saveNodeToLibrary(id, nodeData);
    get().refresh();
    return id;
  },

  removeLibraryItem: (id) => {
    deleteLibraryItem(id);
    get().refresh();
  },

  renameLibraryItem: (id, newName) => {
    renameLibraryItem(id, newName);
    get().refresh();
  },

  fetchMarketplaceItems: async () => {
    try {
      const response = await fetch("/api/marketplaces/items");
      if (!response.ok) {
        set({
          marketplaceRefreshing: false,
          marketplaceError: `HTTP ${response.status}`,
        });
        return;
      }

      const data = (await response.json()) as {
        items: MarketplaceLibraryItem[];
        workflows: MarketplaceWorkflowEntry[];
        isRefreshing: boolean;
      };

      set({
        marketplaceItems: data.items,
        marketplaceWorkflows: data.workflows ?? [],
        marketplaceRefreshing: data.isRefreshing,
        marketplaceError: null,
      });

      if (marketplacePollTimer) clearTimeout(marketplacePollTimer);
      if (data.isRefreshing) {
        marketplacePollTimer = setTimeout(() => {
          marketplacePollTimer = null;
          void get().fetchMarketplaceItems();
        }, 2000);
      }
    } catch (error) {
      console.error("[library-store] Failed to fetch marketplace items:", error);
      set({
        marketplaceRefreshing: false,
        marketplaceError: String(error),
      });
    }
  },

  refreshMarketplaces: async () => {
    set({ marketplaceRefreshing: true, marketplaceError: null });
    try {
      await fetch("/api/marketplaces", { method: "POST" });
    } catch {
      // POST is fire-and-forget; errors are non-fatal.
    }

    await get().fetchMarketplaceItems();
  },
}));



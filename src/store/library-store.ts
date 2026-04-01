import { create } from "zustand";
import { customAlphabet } from "nanoid";
import type { SavedWorkflowEntry, LibraryItemEntry, LibraryCategory } from "@/lib/library";
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
import type { MarketplaceLibraryItem, MarketplaceWorkflowEntry } from "@/lib/marketplace/types";
import { useWorkflowStore } from "@/store/workflow";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

let _pollTimer: ReturnType<typeof setTimeout> | null = null;

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
      get().refresh();
      get().fetchMarketplaceItems();
    }
    set({ sidebarOpen: willOpen });
  },

  openSidebar: () => {
    useWorkflowStore.getState().closePropertiesPanel();
    get().refresh();
    get().fetchMarketplaceItems();
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
      const res = await fetch("/api/marketplaces/items");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
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

      // Poll while server is still refreshing
      if (_pollTimer) clearTimeout(_pollTimer);
      if (data.isRefreshing) {
        _pollTimer = setTimeout(() => {
          _pollTimer = null;
          get().fetchMarketplaceItems();
        }, 2000);
      }
    } catch (err) {
      console.error("[library-store] Failed to fetch marketplace items:", err);
      set({ marketplaceError: String(err) });
    }
  },

  refreshMarketplaces: async () => {
    set({ marketplaceRefreshing: true });
    try {
      await fetch("/api/marketplaces", { method: "POST" });
    } catch {
      // POST is fire-and-forget; errors are non-fatal
    }
    // Fetch items (will poll until server refresh completes)
    await get().fetchMarketplaceItems();
  },
}));


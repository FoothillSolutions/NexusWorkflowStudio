import type {
  LibraryCategory,
  LibraryItemEntry,
  SavedWorkflowEntry,
} from "@/lib/library";
import type { WorkflowJSON } from "@/types/workflow";

export type LibraryPanelCategory = LibraryCategory | "all";

export interface LibraryPanelProps {
  onLoadWorkflow?: (workflow: WorkflowJSON, entryId: string) => void;
  onLoadItem?: (item: LibraryItemEntry) => void;
}

export interface PendingDelete {
  id: string;
  type: "workflow" | "item";
  name: string;
}

export type LibraryCategoryCountMap = Record<string, number>;

export interface LibraryPanelController {
  entries: SavedWorkflowEntry[];
  libraryItems: LibraryItemEntry[];
  activeCategory: LibraryPanelCategory;
  activeCategoryLabel: string;
  sidebarOpen: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredWorkflows: SavedWorkflowEntry[];
  filteredItems: LibraryItemEntry[];
  categoryCounts: LibraryCategoryCountMap;
  hasItems: boolean;
  confirmDelete: PendingDelete | null;
  closeSidebar: () => void;
  setActiveCategory: (category: LibraryPanelCategory) => void;
  dismissDeleteDialog: () => void;
  executeDelete: () => void;
  handleLoadWorkflow: (id: string) => void;
  handleLoadItem: (item: LibraryItemEntry) => void;
  handleUpdateWorkflow: (id: string) => void;
  requestWorkflowDelete: (id: string) => void;
  requestLibraryItemDelete: (id: string) => void;
}


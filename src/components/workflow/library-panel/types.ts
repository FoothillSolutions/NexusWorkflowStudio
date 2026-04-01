import type {
  LibraryCategory,
  LibraryItemEntry,
  SavedWorkflowEntry,
} from "@/lib/library";
import type {
  MarketplaceLibraryItem,
  MarketplaceWorkflowEntry,
} from "@/lib/marketplace/types";
import type { WorkflowJSON } from "@/types/workflow";

export type LibraryPanelCategory = LibraryCategory | "all";
export type LibraryPanelItem = LibraryItemEntry | MarketplaceLibraryItem;

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
  marketplaceItems: MarketplaceLibraryItem[];
  marketplaceWorkflows: MarketplaceWorkflowEntry[];
  activeCategory: LibraryPanelCategory;
  activeCategoryLabel: string;
  sidebarOpen: boolean;
  marketplaceRefreshing: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredWorkflows: SavedWorkflowEntry[];
  filteredMarketplaceWorkflows: MarketplaceWorkflowEntry[];
  filteredItems: LibraryPanelItem[];
  categoryCounts: LibraryCategoryCountMap;
  hasItems: boolean;
  confirmDelete: PendingDelete | null;
  closeSidebar: () => void;
  setActiveCategory: (category: LibraryPanelCategory) => void;
  refreshMarketplaces: () => Promise<void>;
  dismissDeleteDialog: () => void;
  executeDelete: () => void;
  handleLoadWorkflow: (id: string) => void;
  handleLoadMarketplaceWorkflow: (workflow: MarketplaceWorkflowEntry) => void;
  handleLoadItem: (item: LibraryPanelItem) => void;
  handleUpdateWorkflow: (id: string) => void;
  requestWorkflowDelete: (id: string) => void;
  requestLibraryItemDelete: (id: string) => void;
}


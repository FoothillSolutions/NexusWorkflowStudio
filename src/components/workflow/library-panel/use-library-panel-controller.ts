import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSavedWorkflowsStore } from "@/store/library";
import { useWorkflowStore } from "@/store/workflow";
import type { LibraryItemEntry, SavedWorkflowEntry } from "@/lib/library";
import {
  collectSearchableStrings,
  rankLibrarySearchResults,
  type LibrarySearchField,
} from "@/lib/library-search";
import type { MarketplaceWorkflowEntry } from "@/lib/marketplace/types";
import { normalizeSubWorkflowContents } from "@/nodes/sub-workflow/constants";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import { WorkflowNodeType, type WorkflowNodeData } from "@/types/workflow";
import { getLibraryCategoryLabel } from "./constants";
import type {
  LibraryPanelItem,
  LibraryPanelController,
  LibraryPanelProps,
  PendingDelete,
} from "./types";

export function useLibraryPanelController({
  onLoadWorkflow,
  onLoadItem,
}: LibraryPanelProps): LibraryPanelController {
  const entries = useSavedWorkflowsStore((state) => state.entries);
  const libraryItems = useSavedWorkflowsStore((state) => state.libraryItems);
  const marketplaceItems = useSavedWorkflowsStore((state) => state.marketplaceItems);
  const marketplaceWorkflows = useSavedWorkflowsStore((state) => state.marketplaceWorkflows);
  const marketplaceRefreshing = useSavedWorkflowsStore((state) => state.marketplaceRefreshing);
  const activeCategory = useSavedWorkflowsStore((state) => state.activeCategory);
  const sidebarOpen = useSavedWorkflowsStore((state) => state.sidebarOpen);
  const closeSidebar = useSavedWorkflowsStore((state) => state.closeSidebar);
  const remove = useSavedWorkflowsStore((state) => state.remove);
  const load = useSavedWorkflowsStore((state) => state.load);
  const removeLibraryItem = useSavedWorkflowsStore((state) => state.removeLibraryItem);
  const setActiveCategory = useSavedWorkflowsStore((state) => state.setActiveCategory);
  const refreshMarketplaces = useSavedWorkflowsStore((state) => state.refreshMarketplaces);

  const getWorkflowJSON = useWorkflowStore((state) => state.getWorkflowJSON);
  const loadWorkflow = useWorkflowStore((state) => state.loadWorkflow);
  const addNode = useWorkflowStore((state) => state.addNode);

  const [confirmDelete, setConfirmDelete] = useState<PendingDelete | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleLoadWorkflow = useCallback(
    (id: string) => {
      const data = load(id);
      if (!data) {
        toast.error("Failed to load workflow");
        return;
      }

      if (onLoadWorkflow) {
        onLoadWorkflow(data, id);
      } else {
        loadWorkflow(data, { savedToLibrary: true });
      }

      window.dispatchEvent(new CustomEvent("nexus:fit-view"));
      toast.success("Workflow loaded");
    },
    [load, loadWorkflow, onLoadWorkflow],
  );

  const handleLoadMarketplaceWorkflow = useCallback(
    (workflowEntry: MarketplaceWorkflowEntry) => {
      if (onLoadWorkflow) {
        onLoadWorkflow(workflowEntry.workflow, workflowEntry.id);
      } else {
        loadWorkflow(workflowEntry.workflow, { savedToLibrary: false });
      }

      useSavedWorkflowsStore.getState().clearActiveId();
      window.dispatchEvent(new CustomEvent("nexus:fit-view"));
      toast.success("Marketplace workflow loaded");
    },
    [loadWorkflow, onLoadWorkflow],
  );

  const handleLoadItem = useCallback(
    (item: LibraryPanelItem) => {
      if (onLoadItem) {
        onLoadItem(item as LibraryItemEntry);
        return;
      }

      const viewport = useWorkflowStore.getState().viewport;
      const centerX = (-viewport.x + 500) / viewport.zoom;
      const centerY = (-viewport.y + 300) / viewport.zoom;
      const existingNodeIds = new Set(useWorkflowStore.getState().nodes.map((node) => node.id));

      addNode(item.nodeType, { x: centerX, y: centerY });

      const state = useWorkflowStore.getState();
      const insertedNode = state.nodes.find((node) => !existingNodeIds.has(node.id));
      if (!insertedNode) {
        toast.error(`Unable to add "${item.name}" to the canvas`);
        return;
      }

      const normalizedNodeData = {
        ...item.nodeData,
        name: insertedNode.id,
        ...(item.nodeType === WorkflowNodeType.SubWorkflow
          ? normalizeSubWorkflowContents(item.nodeData as Partial<SubWorkflowNodeData>)
          : {}),
      } as Partial<WorkflowNodeData>;

      state.updateNodeData(insertedNode.id, normalizedNodeData);
      toast.success(`"${item.name}" added to canvas`);
    },
    [addNode, onLoadItem],
  );

  const requestWorkflowDelete = useCallback((id: string) => {
    const entry = useSavedWorkflowsStore.getState().entries.find((candidate) => candidate.id === id);
    setConfirmDelete({ id, type: "workflow", name: entry?.name ?? "Unknown" });
  }, []);

  const requestLibraryItemDelete = useCallback((id: string) => {
    const item = useSavedWorkflowsStore.getState().libraryItems.find((candidate) => candidate.id === id);
    setConfirmDelete({ id, type: "item", name: item?.name ?? "Unknown" });
  }, []);

  const dismissDeleteDialog = useCallback(() => {
    setConfirmDelete(null);
  }, []);

  const executeDelete = useCallback(() => {
    if (!confirmDelete) return;

    if (confirmDelete.type === "workflow") {
      remove(confirmDelete.id);
    } else {
      removeLibraryItem(confirmDelete.id);
    }

    setConfirmDelete(null);
    toast.success("Deleted successfully");
  }, [confirmDelete, remove, removeLibraryItem]);

  const handleUpdateWorkflow = useCallback(
    (id: string) => {
      const json = getWorkflowJSON();
      useSavedWorkflowsStore.getState().save(json, id);
      toast.success("Workflow updated");
    },
    [getWorkflowJSON],
  );

  const trimmedSearchQuery = searchQuery.trim();

  const allItems = useMemo(
    () => [...libraryItems, ...marketplaceItems] as LibraryPanelItem[],
    [libraryItems, marketplaceItems],
  );

  const filteredWorkflows = useMemo(() => {
    if (activeCategory !== "all" && activeCategory !== "workflow") return [];

    return rankLibrarySearchResults(entries, trimmedSearchQuery, getSavedWorkflowSearchFields);
  }, [activeCategory, entries, trimmedSearchQuery]);

  const filteredMarketplaceWorkflows = useMemo(() => {
    if (activeCategory !== "all" && activeCategory !== "workflow") return [];

    return rankLibrarySearchResults(
      marketplaceWorkflows,
      trimmedSearchQuery,
      getMarketplaceWorkflowSearchFields,
    );
  }, [activeCategory, marketplaceWorkflows, trimmedSearchQuery]);

  const filteredItems = useMemo(() => {
    let items = allItems;

    if (activeCategory !== "all") {
      items = items.filter((item) => item.category === activeCategory);
    }

    return rankLibrarySearchResults(items, trimmedSearchQuery, getLibraryItemSearchFields);
  }, [activeCategory, allItems, trimmedSearchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: entries.length + allItems.length + marketplaceWorkflows.length,
      workflow: entries.length + marketplaceWorkflows.length,
    };

    for (const item of allItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }

    return counts;
  }, [entries.length, allItems, marketplaceWorkflows.length]);

  return {
    entries,
    libraryItems,
    marketplaceItems,
    marketplaceWorkflows,
    activeCategory,
    activeCategoryLabel: getLibraryCategoryLabel(activeCategory),
    sidebarOpen,
    marketplaceRefreshing,
    searchQuery,
    setSearchQuery,
    filteredWorkflows,
    filteredMarketplaceWorkflows,
    filteredItems,
    categoryCounts,
    hasItems:
      filteredWorkflows.length > 0 ||
      filteredMarketplaceWorkflows.length > 0 ||
      filteredItems.length > 0,
    confirmDelete,
    closeSidebar,
    setActiveCategory,
    refreshMarketplaces,
    dismissDeleteDialog,
    executeDelete,
    handleLoadWorkflow,
    handleLoadMarketplaceWorkflow,
    handleLoadItem,
    handleUpdateWorkflow,
    requestWorkflowDelete,
    requestLibraryItemDelete,
  };
}

function getWorkflowContentSearchFields(entry: {
  name: string;
  workflow: { name?: string; nodes?: Array<{ data?: unknown }> };
}): LibrarySearchField[] {
  return [
    entry.name,
    entry.workflow.name,
    "workflow",
    ...collectSearchableStrings(entry.workflow.nodes?.map((node) => node.data) ?? []),
  ];
}

function getSavedWorkflowSearchFields(entry: SavedWorkflowEntry): LibrarySearchField[] {
  return getWorkflowContentSearchFields(entry);
}

function getMarketplaceWorkflowSearchFields(entry: MarketplaceWorkflowEntry): LibrarySearchField[] {
  return [
    ...getWorkflowContentSearchFields(entry),
    entry.description,
    entry.marketplaceName,
    entry.pluginName,
  ];
}

function getLibraryItemSearchFields(item: LibraryPanelItem): LibrarySearchField[] {
  return [
    item.name,
    item.description,
    item.category,
    item.nodeType,
    "marketplaceName" in item ? item.marketplaceName : undefined,
    "pluginName" in item ? item.pluginName : undefined,
    ...collectSearchableStrings(item.nodeData),
  ];
}


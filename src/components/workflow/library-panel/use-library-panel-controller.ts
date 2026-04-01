import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSavedWorkflowsStore } from "@/store/library";
import { useWorkflowStore } from "@/store/workflow";
import { normalizeSubWorkflowContents } from "@/nodes/sub-workflow/constants";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import type { WorkflowNodeData } from "@/types/workflow";
import type { LibraryItemEntry } from "@/lib/library";
import { getLibraryCategoryLabel } from "./constants";
import type {
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
  const activeCategory = useSavedWorkflowsStore((state) => state.activeCategory);
  const sidebarOpen = useSavedWorkflowsStore((state) => state.sidebarOpen);
  const closeSidebar = useSavedWorkflowsStore((state) => state.closeSidebar);
  const remove = useSavedWorkflowsStore((state) => state.remove);
  const load = useSavedWorkflowsStore((state) => state.load);
  const removeLibraryItem = useSavedWorkflowsStore((state) => state.removeLibraryItem);
  const setActiveCategory = useSavedWorkflowsStore((state) => state.setActiveCategory);

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

  const handleLoadItem = useCallback(
    (item: LibraryItemEntry) => {
      if (onLoadItem) {
        onLoadItem(item);
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
        ...(item.nodeType === "sub-workflow"
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

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredWorkflows = useMemo(() => {
    if (activeCategory !== "all" && activeCategory !== "workflow") return [];

    return entries.filter(
      (entry) =>
        !normalizedSearchQuery || entry.name.toLowerCase().includes(normalizedSearchQuery),
    );
  }, [activeCategory, entries, normalizedSearchQuery]);

  const filteredItems = useMemo(() => {
    let items = libraryItems;

    if (activeCategory !== "all") {
      items = items.filter((item) => item.category === activeCategory);
    }

    if (!normalizedSearchQuery) return items;

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedSearchQuery) ||
        item.description?.toLowerCase().includes(normalizedSearchQuery),
    );
  }, [activeCategory, libraryItems, normalizedSearchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: entries.length + libraryItems.length,
      workflow: entries.length,
    };

    for (const item of libraryItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }

    return counts;
  }, [entries.length, libraryItems]);

  return {
    entries,
    libraryItems,
    activeCategory,
    activeCategoryLabel: getLibraryCategoryLabel(activeCategory),
    sidebarOpen,
    searchQuery,
    setSearchQuery,
    filteredWorkflows,
    filteredItems,
    categoryCounts,
    hasItems: filteredWorkflows.length > 0 || filteredItems.length > 0,
    confirmDelete,
    closeSidebar,
    setActiveCategory,
    dismissDeleteDialog,
    executeDelete,
    handleLoadWorkflow,
    handleLoadItem,
    handleUpdateWorkflow,
    requestWorkflowDelete,
    requestLibraryItemDelete,
  };
}


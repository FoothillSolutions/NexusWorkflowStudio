import { useCallback, useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
import type { NodeType, WorkflowNode } from "@/types/workflow";
import { isModKey } from "@/lib/platform";
import { toast } from "sonner";
import type { ContextMenuTarget } from "@/components/workflow/context-menu";

export interface CtxMenu {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

interface CanvasInteractionCallbacks {
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  deleteNode?: (id: string) => void;
  duplicateNode: (id: string) => void;
  duplicateSelectedNodes: () => void;
  deleteSelectedNodes: () => void;
  setDeleteTarget?: (target: { type: "node" | "edge" | "selection"; id: string }) => void;
  selectAll?: () => void;
  getNodes: () => WorkflowNode[];
  autoLayout: () => void;
  onEscape?: () => void;
  /** Whether shortcuts that conflict with sub-workflow should be skipped */
  isSubWorkflow?: boolean;
}

/**
 * Shared hook for canvas interactions: context menu, drag-and-drop, keyboard shortcuts.
 */
export function useCanvasInteractions(callbacks: CanvasInteractionCallbacks) {
  const {
    addNode,
    deleteNode,
    duplicateNode,
    duplicateSelectedNodes,
    deleteSelectedNodes,
    setDeleteTarget,
    selectAll,
    getNodes,
    autoLayout,
    onEscape,
    isSubWorkflow,
  } = callbacks;

  const { screenToFlowPosition } = useReactFlow();
  const setCanvasMode = useWorkflowStore((s) => s.setCanvasMode);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const closeMenu = useCallback(() => setCtxMenu(null), []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string; data?: { type?: string } }) => {
      event.preventDefault();
      setCtxMenu({
        x: event.clientX,
        y: event.clientY,
        target: {
          kind: "node",
          nodeId: node.id,
          nodeType: (node.data?.type ?? "start") as NodeType,
          isDeletable: node.data?.type !== "start",
          isDuplicatable: node.data?.type !== "start",
        },
      });
    },
    []
  );

  const onSelectionContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setCtxMenu({ x: event.clientX, y: event.clientY, target: { kind: "selection" } });
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setCtxMenu({
      x: (event as React.MouseEvent).clientX,
      y: (event as React.MouseEvent).clientY,
      target: { kind: "pane" },
    });
  }, []);

  // Drag & drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type as NodeType, position);
    },
    [screenToFlowPosition, addNode]
  );

  // Selected count
  const nodes = getNodes();
  const selectedCount = useMemo(() => nodes.filter((n) => n.selected).length, [nodes]);

  // Context menu action handlers
  const handleDelete = useCallback(() => {
    if (ctxMenu?.target.kind === "node") {
      if (setDeleteTarget) {
        setDeleteTarget({ type: "node", id: ctxMenu.target.nodeId });
      } else if (deleteNode) {
        deleteNode(ctxMenu.target.nodeId);
      }
    }
  }, [ctxMenu, setDeleteTarget, deleteNode]);

  const handleDuplicate = useCallback(() => {
    if (ctxMenu?.target.kind === "node") {
      duplicateNode(ctxMenu.target.nodeId);
    }
  }, [ctxMenu, duplicateNode]);

  const handleDeleteSelected = useCallback(() => {
    if (setDeleteTarget) {
      setDeleteTarget({ type: "selection", id: "multi" });
    } else {
      deleteSelectedNodes();
    }
  }, [setDeleteTarget, deleteSelectedNodes]);

  const handleDuplicateSelected = useCallback(() => {
    duplicateSelectedNodes();
  }, [duplicateSelectedNodes]);

  const handleSaveToLibrary = useCallback(() => {
    const target = ctxMenu?.target;
    if (target?.kind === "node") {
      const node = getNodes().find((n) => n.id === target.nodeId);
      if (node?.data) {
        const { saveNodeToLib } = useSavedWorkflowsStore.getState();
        saveNodeToLib(node.data);
        toast.success(`"${node.data.label || node.data.type}" saved to library`);
      }
    }
  }, [ctxMenu, getNodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSubWorkflow && useWorkflowStore.getState().activeSubWorkflowNodeId) return;

      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      const isMod = isModKey(e);
      const currentNodes = getNodes();
      const selected = currentNodes.filter((n) => n.selected);
      const multiSelected = selected.length > 1;
      const singleSelected = selected.length === 1 && selected[0].data?.type !== "start";

      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (!isMod && !e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setCanvasMode("hand");
        return;
      }

      if (!isMod && !e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setCanvasMode("selection");
        return;
      }

      if (isMod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        autoLayout();
        return;
      }

      if (isMod && e.key === "a" && selectAll) {
        e.preventDefault();
        selectAll();
        return;
      }

      if (isMod && e.key === "d") {
        e.preventDefault();
        if (multiSelected) duplicateSelectedNodes();
        else if (singleSelected) duplicateNode(selected[0].id);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (multiSelected) {
          const deletableCount = selected.filter((n) => n.data?.type !== "start").length;
          if (deletableCount > 0) {
            if (setDeleteTarget) {
              setDeleteTarget({ type: "selection", id: "multi" });
            } else {
              deleteSelectedNodes();
            }
          }
        } else if (singleSelected) {
          if (setDeleteTarget) {
            setDeleteTarget({ type: "node", id: selected[0].id });
          } else if (deleteNode) {
            deleteNode(selected[0].id);
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    autoLayout,
    duplicateNode,
    duplicateSelectedNodes,
    deleteSelectedNodes,
    deleteNode,
    setDeleteTarget,
    selectAll,
    onEscape,
    isSubWorkflow,
    getNodes,
    setCanvasMode,
  ]);

  return {
    ctxMenu,
    closeMenu,
    selectedCount,
    onNodeContextMenu,
    onSelectionContextMenu,
    onPaneContextMenu,
    onDragOver,
    onDrop,
    handleDelete,
    handleDuplicate,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleSaveToLibrary,
  };
}


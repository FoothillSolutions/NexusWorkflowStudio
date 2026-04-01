import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore, type CanvasMode } from "@/store/workflow";
import { useSavedWorkflowsStore } from "@/store/library";
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
  copyNode: (id: string) => number;
  copySelectedNodes: () => number;
  duplicateNode: (id: string) => void;
  duplicateSelectedNodes: () => void;
  deleteSelectedNodes: () => void;
  pasteNodes: (targetPosition?: { x: number; y: number }) => number;
  hasClipboardData?: () => boolean;
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
    copyNode,
    copySelectedNodes,
    duplicateNode,
    duplicateSelectedNodes,
    deleteSelectedNodes,
    pasteNodes,
    hasClipboardData,
    setDeleteTarget,
    selectAll,
    getNodes,
    autoLayout,
    onEscape,
    isSubWorkflow,
  } = callbacks;

  const { screenToFlowPosition } = useReactFlow();
  const canvasMode = useWorkflowStore((s) => s.canvasMode);
  const setCanvasMode = useWorkflowStore((s) => s.setCanvasMode);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [isShiftSelectionActive, setIsShiftSelectionActive] = useState(false);

  const updatePointerPosition = useCallback(
    (clientX: number, clientY: number) => {
      lastPointerPositionRef.current = screenToFlowPosition({ x: clientX, y: clientY });
    },
    [screenToFlowPosition]
  );

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const closeMenu = useCallback(() => setCtxMenu(null), []);

  const onCanvasMouseMove = useCallback(
    (event: React.MouseEvent) => {
      updatePointerPosition(event.clientX, event.clientY);
    },
    [updatePointerPosition]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string; data?: { type?: string } }) => {
      event.preventDefault();
      updatePointerPosition(event.clientX, event.clientY);
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
    [updatePointerPosition]
  );

  const onSelectionContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    updatePointerPosition(event.clientX, event.clientY);
    setCtxMenu({ x: event.clientX, y: event.clientY, target: { kind: "selection" } });
  }, [updatePointerPosition]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    updatePointerPosition((event as React.MouseEvent).clientX, (event as React.MouseEvent).clientY);
    setCtxMenu({
      x: (event as React.MouseEvent).clientX,
      y: (event as React.MouseEvent).clientY,
      target: { kind: "pane" },
    });
  }, [updatePointerPosition]);

  // Drag & drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    const draggedNodeType =
      event.dataTransfer.getData("application/reactflow") ||
      useWorkflowStore.getState().currentDraggedNodeType;
    if (!draggedNodeType) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type =
        event.dataTransfer.getData("application/reactflow") ||
        useWorkflowStore.getState().currentDraggedNodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type as NodeType, position);
      useWorkflowStore.getState().setCurrentDraggedNodeType(null);
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

  const handleCopy = useCallback(() => {
    if (ctxMenu?.target.kind !== "node") return;
    const copiedCount = copyNode(ctxMenu.target.nodeId);
    if (copiedCount > 0) {
      toast.success(copiedCount === 1 ? "Node copied" : `${copiedCount} nodes copied`);
    }
  }, [copyNode, ctxMenu]);

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

  const handleCopySelected = useCallback(() => {
    const copiedCount = copySelectedNodes();
    if (copiedCount > 0) {
      toast.success(copiedCount === 1 ? "Node copied" : `${copiedCount} nodes copied`);
    }
  }, [copySelectedNodes]);

  const handlePaste = useCallback(() => {
    const pastedCount = pasteNodes(lastPointerPositionRef.current ?? undefined);
    if (pastedCount > 0) {
      toast.success(pastedCount === 1 ? "Node pasted" : `${pastedCount} nodes pasted`);
    }
  }, [pasteNodes]);

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

      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "Shift") {
        if (useWorkflowStore.getState().canvasMode === "hand") {
          setIsShiftSelectionActive(true);
        }
        return;
      }

      const isMod = isModKey(e);
      const lowerKey = e.key.toLowerCase();
      const currentNodes = getNodes();
      const selected = currentNodes.filter((n) => n.selected);
      const copyableSelected = selected.filter((n) => n.data?.type !== "start");
      const multiSelected = selected.length > 1;
      const singleSelected = selected.length === 1 && selected[0].data?.type !== "start";

      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (!isMod && !e.shiftKey && lowerKey === "h") {
        e.preventDefault();
        setCanvasMode("hand");
        return;
      }

      if (!isMod && !e.shiftKey && lowerKey === "v") {
        e.preventDefault();
        setCanvasMode("selection");
        return;
      }

      if (isMod && !e.shiftKey && lowerKey === "c") {
        if (copyableSelected.length === 0) return;
        e.preventDefault();
        const copiedCount = copySelectedNodes();
        if (copiedCount > 0) {
          toast.success(copiedCount === 1 ? "Node copied" : `${copiedCount} nodes copied`);
        }
        return;
      }

      if (isMod && !e.shiftKey && lowerKey === "v") {
        if (!hasClipboardData?.()) return;
        e.preventDefault();
        const pastedCount = pasteNodes(lastPointerPositionRef.current ?? undefined);
        if (pastedCount > 0) {
          toast.success(pastedCount === 1 ? "Node pasted" : `${pastedCount} nodes pasted`);
        }
        return;
      }

      if (isMod && e.shiftKey && lowerKey === "l") {
        e.preventDefault();
        autoLayout();
        return;
      }

      if (isMod && lowerKey === "a" && selectAll) {
        e.preventDefault();
        selectAll();
        return;
      }

      if (isMod && lowerKey === "d") {
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

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftSelectionActive(false);
      }
    };

    const resetShiftSelection = () => {
      setIsShiftSelectionActive(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", resetShiftSelection);
    document.addEventListener("visibilitychange", resetShiftSelection);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", resetShiftSelection);
      document.removeEventListener("visibilitychange", resetShiftSelection);
    };
  }, [
    autoLayout,
    canvasMode,
    copySelectedNodes,
    duplicateNode,
    duplicateSelectedNodes,
    deleteSelectedNodes,
    deleteNode,
    hasClipboardData,
    setDeleteTarget,
    selectAll,
    onEscape,
    isSubWorkflow,
    getNodes,
    pasteNodes,
    setCanvasMode,
  ]);

  const canPaste = hasClipboardData?.() ?? false;
  const activeCanvasMode: CanvasMode = isShiftSelectionActive && canvasMode === "hand"
    ? "selection"
    : canvasMode;

  return {
    activeCanvasMode,
    canPaste,
    ctxMenu,
    closeMenu,
    selectedCount,
    onNodeContextMenu,
    onSelectionContextMenu,
    onPaneContextMenu,
    onCanvasMouseMove,
    onDragOver,
    onDrop,
    handleCopy,
    handleDelete,
    handleCopySelected,
    handleDuplicate,
    handleDeleteSelected,
    handleDuplicateSelected,
    handlePaste,
    handleSaveToLibrary,
  };
}


"use client";

import { useCallback, useEffect } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { useDragTracking } from "@/hooks/use-drag-tracking";
import { useAutoLayout } from "@/hooks/use-auto-layout";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";
import { CanvasShell } from "@/components/workflow/canvas-shell";
import { ContextMenu } from "@/components/workflow/context-menu";

export default function Canvas() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const storeOnNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const openPropertiesPanel = useWorkflowStore((s) => s.openPropertiesPanel);
  const setViewport = useWorkflowStore((s) => s.setViewport);
  const minimapVisible = useWorkflowStore((s) => s.minimapVisible);
  const toggleMinimap = useWorkflowStore((s) => s.toggleMinimap);
  const setDeleteTarget = useWorkflowStore((s) => s.setDeleteTarget);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const duplicateSelectedNodes = useWorkflowStore((s) => s.duplicateSelectedNodes);
  const deleteSelectedNodes = useWorkflowStore((s) => s.deleteSelectedNodes);
  const selectAll = useWorkflowStore((s) => s.selectAll);
  const canvasMode = useWorkflowStore((s) => s.canvasMode);
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);
  const groupIntoSubWorkflow = useWorkflowStore((s) => s.groupIntoSubWorkflow);

  const { onNodesChange, isDragging } = useDragTracking(storeOnNodesChange);

  const getNodes = useCallback(() => useWorkflowStore.getState().nodes, []);
  const getEdges = useCallback(() => useWorkflowStore.getState().edges, []);

  const setNodesForLayout = useCallback(
    (updater: (prev: import("@/types/workflow").WorkflowNode[]) => import("@/types/workflow").WorkflowNode[]) => {
      const next = updater(useWorkflowStore.getState().nodes);
      useWorkflowStore.setState({ nodes: next });
    },
    []
  );

  const autoLayout = useAutoLayout({
    getNodes,
    getEdges,
    setNodes: setNodesForLayout,
  });

  useEffect(() => {
    const handler = () => autoLayout();
    window.addEventListener("nexus:auto-layout", handler);
    return () => window.removeEventListener("nexus:auto-layout", handler);
  }, [autoLayout]);

  const handleGroupIntoSubWorkflow = useCallback(() => {
    const selectedIds = useWorkflowStore.getState().nodes
      .filter((n) => n.selected && n.data?.type !== "start")
      .map((n) => n.id);
    if (selectedIds.length >= 1) {
      groupIntoSubWorkflow(selectedIds);
    }
  }, [groupIntoSubWorkflow]);

  const {
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
  } = useCanvasInteractions({
    addNode,
    duplicateNode,
    duplicateSelectedNodes,
    deleteSelectedNodes,
    setDeleteTarget,
    selectAll,
    getNodes: () => useWorkflowStore.getState().nodes,
    autoLayout,
  });

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => openPropertiesPanel(node.id),
    [openPropertiesPanel]
  );
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => selectNode(node.id),
    [selectNode]
  );
  const onEdgeClick = useCallback(() => selectNode(null), [selectNode]);
  const onPaneClick = useCallback(() => {
    selectNode(null);
    closeMenu();
  }, [selectNode, closeMenu]);
  const onMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => setViewport(viewport),
    [setViewport]
  );

  return (
    <div className={`w-full h-full relative ${canvasMode === "hand" ? "canvas-hand" : "canvas-selection"}`}>
      <CanvasShell
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        canvasMode={canvasMode}
        edgeStyle={edgeStyle}
        minimapVisible={minimapVisible}
        toggleMinimap={toggleMinimap}
        isDragging={isDragging}
      />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          target={ctxMenu.target}
          selectedCount={selectedCount}
          onClose={closeMenu}
          onDelete={ctxMenu.target.kind === "node" ? handleDelete : undefined}
          onDuplicate={ctxMenu.target.kind === "node" ? handleDuplicate : undefined}
          onDeleteSelected={selectedCount > 1 ? handleDeleteSelected : undefined}
          onDuplicateSelected={selectedCount > 1 ? handleDuplicateSelected : undefined}
          onSaveToLibrary={ctxMenu.target.kind === "node" ? handleSaveToLibrary : undefined}
          onGroupIntoSubWorkflow={selectedCount > 1 ? handleGroupIntoSubWorkflow : undefined}
        />
      )}
    </div>
  );
}

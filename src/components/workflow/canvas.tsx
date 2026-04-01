"use client";

import { useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow";
import { useDragTracking } from "@/hooks/use-drag-tracking";
import { useAutoLayout } from "@/hooks/use-auto-layout";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";
import { useSubWorkflowHoverOpen } from "./use-subworkflow-hover-open";
import { CanvasShell } from "@/components/workflow/canvas-shell";
import { ContextMenu } from "@/components/workflow/context-menu";
import {
  copyNodesToWorkflowClipboard,
  hasWorkflowClipboardData,
  pasteNodesFromWorkflowClipboard,
} from "@/lib/workflow-clipboard";

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
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);
  const groupIntoSubWorkflow = useWorkflowStore((s) => s.groupIntoSubWorkflow);
  const openSubWorkflow = useWorkflowStore((s) => s.openSubWorkflow);
  const moveNodeIntoSubWorkflow = useWorkflowStore((s) => s.moveNodeIntoSubWorkflow);

  const { fitView, getIntersectingNodes } = useReactFlow();
  const { onNodesChange, isDragging } = useDragTracking(storeOnNodesChange);

  const getHoveredSubWorkflowId = useCallback(
    (draggedNode: import("@/types/workflow").WorkflowNode) => {
      if (draggedNode.data?.type === "start") return null;

      const targetNode = (getIntersectingNodes(draggedNode, true) as import("@/types/workflow").WorkflowNode[])
        .find((node) => node.id !== draggedNode.id && node.data?.type === "sub-workflow");

      return targetNode?.id ?? null;
    },
    [getIntersectingNodes]
  );
  const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useSubWorkflowHoverOpen({
    getHoveredSubWorkflowId,
    moveIntoSubWorkflow: moveNodeIntoSubWorkflow,
    openSubWorkflow,
  });

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

  const copyNode = useCallback((nodeId: string) => {
    const state = useWorkflowStore.getState();
    return copyNodesToWorkflowClipboard({
      nodes: state.nodes,
      edges: state.edges,
      nodeIds: [nodeId],
    });
  }, []);

  const copySelectedNodes = useCallback(() => {
    const state = useWorkflowStore.getState();
    return copyNodesToWorkflowClipboard({
      nodes: state.nodes,
      edges: state.edges,
    });
  }, []);

  const pasteNodes = useCallback((targetPosition?: { x: number; y: number }) => {
    const state = useWorkflowStore.getState();
    const pasted = pasteNodesFromWorkflowClipboard({
      nodes: state.nodes,
      edges: state.edges,
      targetPosition,
    });
    if (!pasted) return 0;

    useWorkflowStore.setState({
      nodes: pasted.nodes,
      edges: pasted.edges,
      selectedNodeId: pasted.pastedNodeIds.length === 1 ? pasted.pastedNodeIds[0] : null,
      propertiesPanelOpen: false,
    });

    return pasted.pastedNodeIds.length;
  }, []);

  useEffect(() => {
    const handler = () => autoLayout();
    window.addEventListener("nexus:auto-layout", handler);
    return () => window.removeEventListener("nexus:auto-layout", handler);
  }, [autoLayout]);


  // Re-center the canvas when a new workflow is created or loaded
  useEffect(() => {
    const handler = () => {
      // Small delay so React Flow processes the new nodes first
      requestAnimationFrame(() => fitView({ duration: 300, maxZoom: 0.85, padding: 0.3 }));
    };
    window.addEventListener("nexus:fit-view", handler);
    return () => window.removeEventListener("nexus:fit-view", handler);
  }, [fitView]);

  const handleGroupIntoSubWorkflow = useCallback(() => {
    const selectedIds = useWorkflowStore.getState().nodes
      .filter((n) => n.selected && n.data?.type !== "start")
      .map((n) => n.id);
    if (selectedIds.length >= 1) {
      groupIntoSubWorkflow(selectedIds);
    }
  }, [groupIntoSubWorkflow]);

  const {
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
  } = useCanvasInteractions({
    addNode,
    copyNode,
    copySelectedNodes,
    duplicateNode,
    duplicateSelectedNodes,
    deleteSelectedNodes,
    pasteNodes,
    hasClipboardData: hasWorkflowClipboardData,
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
    <div
      className={`w-full h-full relative ${activeCanvasMode === "hand" ? "canvas-hand" : "canvas-selection"}`}
      onMouseMove={onCanvasMouseMove}
    >
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
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        canvasMode={activeCanvasMode}
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
          onCopy={ctxMenu.target.kind === "node" ? handleCopy : undefined}
          onDelete={ctxMenu.target.kind === "node" ? handleDelete : undefined}
          onCopySelected={selectedCount > 1 ? handleCopySelected : undefined}
          onDuplicate={ctxMenu.target.kind === "node" ? handleDuplicate : undefined}
          onDeleteSelected={selectedCount > 1 ? handleDeleteSelected : undefined}
          onDuplicateSelected={selectedCount > 1 ? handleDuplicateSelected : undefined}
          onPaste={ctxMenu.target.kind === "pane" && canPaste ? handlePaste : undefined}
          onSaveToLibrary={ctxMenu.target.kind === "node" ? handleSaveToLibrary : undefined}
          onGroupIntoSubWorkflow={selectedCount > 1 ? handleGroupIntoSubWorkflow : undefined}
        />
      )}
    </div>
  );
}

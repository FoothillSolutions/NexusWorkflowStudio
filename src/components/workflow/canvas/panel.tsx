"use client";

import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  NON_DELETABLE_NODE_TYPES,
  WorkflowNodeType,
  type WorkflowNode,
} from "@/types/workflow";
import { useWorkflowStore } from "@/store/workflow";
import { useDragTracking } from "@/hooks/use-drag-tracking";
import { useAutoLayout } from "@/hooks/use-auto-layout";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";
import { useSubWorkflowHoverOpen } from "../use-subworkflow-hover-open";
import { CanvasShell } from "@/components/workflow/canvas-shell";
import { ContextMenu } from "@/components/workflow/context-menu";
import { CollabSelectionOverlay } from "@/components/workflow/collaboration/collab-selection-overlay";
import { CollabCursors } from "@/components/workflow/collaboration/collab-cursors";
import { useCursorBroadcast } from "@/components/workflow/collaboration/use-cursor-broadcast";
import {
  copyNodesToWorkflowClipboard,
  hasWorkflowClipboardData,
  pasteNodesFromWorkflowClipboard,
} from "@/lib/workflow-clipboard";

export default function Canvas() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const storeOnNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const addNode = useWorkflowStore((state) => state.addNode);
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const openPropertiesPanel = useWorkflowStore((state) => state.openPropertiesPanel);
  const setViewport = useWorkflowStore((state) => state.setViewport);
  const minimapVisible = useWorkflowStore((state) => state.minimapVisible);
  const toggleMinimap = useWorkflowStore((state) => state.toggleMinimap);
  const setDeleteTarget = useWorkflowStore((state) => state.setDeleteTarget);
  const duplicateNode = useWorkflowStore((state) => state.duplicateNode);
  const duplicateSelectedNodes = useWorkflowStore((state) => state.duplicateSelectedNodes);
  const deleteSelectedNodes = useWorkflowStore((state) => state.deleteSelectedNodes);
  const selectAll = useWorkflowStore((state) => state.selectAll);
  const edgeStyle = useWorkflowStore((state) => state.edgeStyle);
  const groupIntoSubWorkflow = useWorkflowStore((state) => state.groupIntoSubWorkflow);
  const openSubWorkflow = useWorkflowStore((state) => state.openSubWorkflow);
  const moveNodeIntoSubWorkflow = useWorkflowStore((state) => state.moveNodeIntoSubWorkflow);

  const { fitView, getIntersectingNodes } = useReactFlow();
  const { onNodesChange, isDragging } = useDragTracking(storeOnNodesChange);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  useCursorBroadcast(canvasRef);

  const getHoveredSubWorkflowId = useCallback(
    (draggedNode: WorkflowNode) => {
      if (draggedNode.data?.type === WorkflowNodeType.Start) return null;

      const targetNode = (getIntersectingNodes(draggedNode, true) as WorkflowNode[]).find(
        (node) => node.id !== draggedNode.id && node.data?.type === WorkflowNodeType.SubWorkflow,
      );

      return targetNode?.id ?? null;
    },
    [getIntersectingNodes],
  );

  const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useSubWorkflowHoverOpen({
    getHoveredSubWorkflowId,
    moveIntoSubWorkflow: moveNodeIntoSubWorkflow,
    openSubWorkflow,
  });

  const getNodes = useCallback(() => useWorkflowStore.getState().nodes, []);
  const getEdges = useCallback(() => useWorkflowStore.getState().edges, []);

  const setNodesForLayout = useCallback(
    (updater: (prev: WorkflowNode[]) => WorkflowNode[]) => {
      const next = updater(useWorkflowStore.getState().nodes);
      useWorkflowStore.setState({ nodes: next });
    },
    [],
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

  useEffect(() => {
    const handler = () => {
      requestAnimationFrame(() => fitView({ duration: 300, maxZoom: 0.85, padding: 0.3 }));
    };

    window.addEventListener("nexus:fit-view", handler);
    return () => window.removeEventListener("nexus:fit-view", handler);
  }, [fitView]);

  const handleGroupIntoSubWorkflow = useCallback(() => {
    const selectedIds = useWorkflowStore
      .getState()
      .nodes.filter((node) => node.selected && !NON_DELETABLE_NODE_TYPES.has(node.data?.type ?? WorkflowNodeType.Start))
      .map((node) => node.id);

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
    (_event: ReactMouseEvent<Element, MouseEvent>, node: { id: string }) => openPropertiesPanel(node.id),
    [openPropertiesPanel],
  );
  const onNodeClick = useCallback(
    (_event: ReactMouseEvent<Element, MouseEvent>, node: { id: string }) => selectNode(node.id),
    [selectNode],
  );
  const onEdgeClick = useCallback(() => selectNode(null), [selectNode]);
  const onPaneClick = useCallback(() => {
    selectNode(null);
    closeMenu();
  }, [closeMenu, selectNode]);
  const onMoveEnd = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => setViewport(viewport),
    [setViewport],
  );

  return (
    <div
      ref={canvasRef}
      className={`relative h-full w-full ${activeCanvasMode === "hand" ? "canvas-hand" : "canvas-selection"}`}
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
      >
        <CollabSelectionOverlay />
        <CollabCursors />
      </CanvasShell>

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


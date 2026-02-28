"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  type EdgeTypes,
  type NodeChange,
  ConnectionLineType,
  SelectionMode,
} from "@xyflow/react";
import Dagre from "@dagrejs/dagre";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
import type { NodeType, WorkflowNode } from "@/types/workflow";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Map } from "lucide-react";
import {
  BG_CANVAS_HEX,
  CANVAS_DOT_COLOR,
  CANVAS_EDGE_STROKE,
  MINIMAP_MASK_COLOR,
} from "@/lib/theme";
import { NODE_REGISTRY, NODE_TYPE_COMPONENTS } from "@/lib/node-registry";
import { NodeSize, NODE_SIZE_DIMENSIONS } from "@/nodes/shared/base-node";
import { DeletableEdge } from "@/components/edges/deletable-edge";
import { ContextMenu, type ContextMenuTarget } from "@/components/workflow/context-menu";
import { isModKey } from "@/lib/platform";


const edgeTypeComponents: EdgeTypes = {
  deletable: DeletableEdge,
};

interface CtxMenu {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

export default function Canvas() {
  // Use individual selectors so this component only re-renders when the
  // specific slices it needs actually change (nodes, edges, canvasMode, etc.)
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
  const setCanvasMode = useWorkflowStore((s) => s.setCanvasMode);
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);

  // Track dragging to suppress expensive MiniMap renders during drag
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Wrap onNodesChange to track drag state for MiniMap suppression
  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      const hasDragStart = changes.some(
        (c) => c.type === "position" && c.dragging === true
      );
      const hasDragEnd = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );

      if (hasDragStart && !isDraggingRef.current) {
        isDraggingRef.current = true;
        setIsDragging(true);
      }

      storeOnNodesChange(changes);

      if (hasDragEnd && isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    },
    [storeOnNodesChange]
  );

  const { screenToFlowPosition, fitView } = useReactFlow();

  // Memoize nodeTypes to prevent re-renders
  const nodeTypes = useMemo(() => NODE_TYPE_COMPONENTS, []);
  const edgeTypes = useMemo(() => edgeTypeComponents, []);

  // ── Connection line type derived from edgeStyle ─────────────────────────
  const connectionLineType =
    edgeStyle === "smoothstep"
      ? ConnectionLineType.SmoothStep
      : ConnectionLineType.Bezier;

  // ── Auto-layout with dagre ──────────────────────────────────────────────
  const autoLayout = useCallback(() => {
    const currentNodes = useWorkflowStore.getState().nodes;
    const currentEdges = useWorkflowStore.getState().edges;

    if (currentNodes.length === 0) return;

    const defaultDim = NODE_SIZE_DIMENSIONS[NodeSize.Medium];

    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: "LR",
      nodesep: 80,    // vertical gap between sibling nodes
      ranksep: 200,   // horizontal gap between ranks (columns)
      marginx: 60,
      marginy: 60,
    });

    currentNodes.forEach((node) => {
      const entry = NODE_REGISTRY[node.type as NodeType];
      const dim = NODE_SIZE_DIMENSIONS[entry?.size ?? NodeSize.Medium] ?? defaultDim;
      g.setNode(node.id, { width: dim.width, height: dim.height });
    });

    currentEdges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    Dagre.layout(g);

    // Compute target positions (dagre returns center; offset to top-left)
    const targetPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach((node) => {
      const dagreNode = g.node(node.id);
      if (dagreNode) {
        targetPositions[node.id] = {
          x: dagreNode.x - dagreNode.width / 2,
          y: dagreNode.y - dagreNode.height / 2,
        };
      }
    });

    // Animate nodes to target positions
    const duration = 400;
    const start = performance.now();

    const startPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach((node) => {
      startPositions[node.id] = { ...node.position };
    });

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);

      const animatedNodes = useWorkflowStore.getState().nodes.map((node) => {
        const from = startPositions[node.id];
        const to = targetPositions[node.id];
        if (!from || !to) return node;
        return {
          ...node,
          position: {
            x: from.x + (to.x - from.x) * eased,
            y: from.y + (to.y - from.y) * eased,
          },
        };
      });

      useWorkflowStore.setState({ nodes: animatedNodes });

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Fit view after layout
        setTimeout(() => fitView({ duration: 300, padding: 0.55 }), 50);
      }
    };

    requestAnimationFrame(animate);
  }, [fitView]);

  // Listen for auto-layout custom event
  useEffect(() => {
    const handler = () => autoLayout();
    window.addEventListener("nexus:auto-layout", handler);
    return () => window.removeEventListener("nexus:auto-layout", handler);
  }, [autoLayout]);

  // ── Context menu state ──────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const closeMenu = useCallback(() => setCtxMenu(null), []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string; data?: { type?: string }; deletable?: boolean }) => {
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
    setCtxMenu({
      x: event.clientX,
      y: event.clientY,
      target: { kind: "selection" },
    });
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setCtxMenu({
      x: (event as React.MouseEvent).clientX,
      y: (event as React.MouseEvent).clientY,
      target: { kind: "pane" },
    });
  }, []);

  // ── Drag & drop ─────────────────────────────────────────────────────────
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type as NodeType, position);
    },
    [screenToFlowPosition, addNode]
  );

  // ── Context menu handlers ────────────────────────────────────────────────
  const selectedCount = useMemo(() => nodes.filter((n) => n.selected).length, [nodes]);

  const handleDelete = useCallback(() => {
    if (ctxMenu?.target.kind === "node") {
      setDeleteTarget({ type: "node", id: ctxMenu.target.nodeId });
    }
  }, [ctxMenu, setDeleteTarget]);

  const handleDuplicate = useCallback(() => {
    if (ctxMenu?.target.kind === "node") {
      duplicateNode(ctxMenu.target.nodeId);
    }
  }, [ctxMenu, duplicateNode]);

  const handleDeleteSelected = useCallback(() => {
    setDeleteTarget({ type: "selection", id: "multi" });
  }, [setDeleteTarget]);

  const handleDuplicateSelected = useCallback(() => {
    duplicateSelectedNodes();
  }, [duplicateSelectedNodes]);

  const handleSaveToLibrary = useCallback(() => {
    const target = ctxMenu?.target;
    if (target?.kind === "node") {
      const node = useWorkflowStore.getState().nodes.find((n) => n.id === target.nodeId);
      if (node?.data) {
        const { saveNodeToLib } = useSavedWorkflowsStore.getState();
        saveNodeToLib(node.data);
        toast.success(`"${node.data.label || node.data.type}" saved to library`);
      }
    }
  }, [ctxMenu]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside an input / textarea / contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      const isMod = isModKey(e);
      // Read nodes from the store at event time instead of closing over the
      // `nodes` prop, which changes on every drag frame and forces this
      // effect to be rebuilt.
      const currentNodes = useWorkflowStore.getState().nodes;
      const selected = currentNodes.filter((n) => n.selected);
      const multiSelected = selected.length > 1;
      const singleSelected = selected.length === 1 && selected[0].data?.type !== "start";

      // ── H → Hand tool ─────────────────────────────────────────────────
      if (!isMod && !e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setCanvasMode("hand");
        return;
      }

      // ── V → Selection tool ────────────────────────────────────────────
      if (!isMod && !e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setCanvasMode("selection");
        return;
      }

      // ── Ctrl/Cmd + Shift + L → Auto-layout ───────────────────────────
      if (isMod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        autoLayout();
        return;
      }

      // ── Ctrl/Cmd + A → select all ─────────────────────────────────────
      if (isMod && e.key === "a") {
        e.preventDefault();
        selectAll();
        return;
      }

      // ── Ctrl/Cmd + D → duplicate ──────────────────────────────────────
      if (isMod && e.key === "d") {
        e.preventDefault();
        if (multiSelected) {
          duplicateSelectedNodes();
        } else if (singleSelected) {
          duplicateNode(selected[0].id);
        }
        return;
      }

      // ── Delete / Backspace → delete ───────────────────────────────────
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (multiSelected) {
          const deletableCount = selected.filter((n) => n.data?.type !== "start").length;
          if (deletableCount > 0) {
            setDeleteTarget({ type: "selection", id: "multi" });
          }
        } else if (singleSelected) {
          setDeleteTarget({ type: "node", id: selected[0].id });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectAll, duplicateNode, duplicateSelectedNodes, deleteSelectedNodes, setDeleteTarget, setCanvasMode, autoLayout]);

  // ── Memoize event handlers for ReactFlow to avoid new references each render ──
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

  // Memoize static object props so ReactFlow doesn't see new references every frame
  const connectionLineStyle = useMemo(
    () => ({ stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 }),
    []
  );
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "deletable" as const,
      style: { stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 },
      animated: false,
    }),
    []
  );
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const rfStyle = useMemo(() => ({ backgroundColor: BG_CANVAS_HEX }), []);
  const panOnDrag = useMemo(
    () => (canvasMode === "hand" ? [0, 1, 2] : [1, 2]),
    [canvasMode]
  );
  const minimapNodeColor = useCallback(
    (node: { type?: string }) =>
      NODE_REGISTRY[node.type as NodeType]?.accentHex ?? "#52525b",
    []
  );

  return (
    <div
      className={`w-full h-full relative ${canvasMode === "hand" ? "canvas-hand" : "canvas-selection"}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        deleteKeyCode={null}
        connectionLineType={connectionLineType}
        connectionLineStyle={connectionLineStyle}
        fitView
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={proOptions}
        style={rfStyle}
        // ── Mode-dependent interaction ──────────────────────────────────
        selectionOnDrag={canvasMode === "selection"}
        selectionMode={SelectionMode.Partial}
        panOnDrag={panOnDrag}
        panOnScroll={false}
        nodesDraggable={true}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color={CANVAS_DOT_COLOR}
          gap={20}
          size={1}
        />
        {minimapVisible && !isDragging && (
          <MiniMap
            className="!bg-zinc-900 !border-zinc-700"
            nodeColor={minimapNodeColor}
            maskColor={MINIMAP_MASK_COLOR}
          />
        )}
      </ReactFlow>

      {/* Minimap toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMinimap}
        className="absolute bottom-4 right-4 z-10 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 h-8 w-8"
        title={minimapVisible ? "Hide Minimap" : "Show Minimap"}
      >
        <Map size={16} />
      </Button>

      {/* Context menu */}
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
        />
      )}
    </div>
  );
}

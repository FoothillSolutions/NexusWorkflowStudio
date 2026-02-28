"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  type EdgeTypes,
  ConnectionLineType,
  SelectionMode,
} from "@xyflow/react";
import Dagre from "@dagrejs/dagre";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
import type { NodeType } from "@/types/workflow";
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


const edgeTypeComponents: EdgeTypes = {
  deletable: DeletableEdge,
};

interface CtxMenu {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

export default function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
    selectedNodeId,
    openPropertiesPanel,
    setViewport,
    minimapVisible,
    toggleMinimap,
    setDeleteTarget,
    duplicateNode,
    duplicateSelectedNodes,
    deleteSelectedNodes,
    selectAll,
    canvasMode,
    setCanvasMode,
    edgeStyle,
  } = useWorkflowStore();

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
  const selectedCount = nodes.filter((n) => n.selected).length;

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
      const node = nodes.find((n) => n.id === target.nodeId);
      if (node?.data) {
        const { saveNodeToLib } = useSavedWorkflowsStore.getState();
        saveNodeToLib(node.data);
        toast.success(`"${node.data.label || node.data.type}" saved to library`);
      }
    }
  }, [ctxMenu, nodes]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside an input / textarea / contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      const isMod = e.ctrlKey || e.metaKey;
      const selected = nodes.filter((n) => n.selected);
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
  }, [nodes, selectedNodeId, selectAll, duplicateNode, duplicateSelectedNodes, deleteSelectedNodes, setDeleteTarget, setCanvasMode, autoLayout]);

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
        onNodeDoubleClick={(_, node) => openPropertiesPanel(node.id)}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={() => selectNode(null)}
        onPaneClick={() => { selectNode(null); closeMenu(); }}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        deleteKeyCode={null}
        connectionLineType={connectionLineType}
        connectionLineStyle={{ stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 }}
        fitView
        defaultEdgeOptions={{
          type: "deletable",
          style: { stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 },
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: BG_CANVAS_HEX }}
        // ── Mode-dependent interaction ──────────────────────────────────
        selectionOnDrag={canvasMode === "selection"}
        selectionMode={SelectionMode.Partial}
        panOnDrag={canvasMode === "hand" ? [0, 1, 2] : [1, 2]}
        panOnScroll={false}
        nodesDraggable={true}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color={CANVAS_DOT_COLOR}
          gap={20}
          size={1}
        />
        {minimapVisible && (
          <MiniMap
            className="!bg-zinc-900 !border-zinc-700"
            nodeColor={(node) =>
              NODE_REGISTRY[node.type as NodeType]?.accentHex ?? "#52525b"
            }
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

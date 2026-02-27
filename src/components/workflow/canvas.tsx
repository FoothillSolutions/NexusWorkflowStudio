"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type EdgeTypes,
  ConnectionLineType,
  SelectionMode,
} from "@xyflow/react";
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
  } = useWorkflowStore();

  const { screenToFlowPosition } = useReactFlow();

  // Memoize nodeTypes to prevent re-renders
  const nodeTypes = useMemo(() => NODE_TYPE_COMPONENTS, []);
  const edgeTypes = useMemo(() => edgeTypeComponents, []);

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
  }, [nodes, selectedNodeId, selectAll, duplicateNode, duplicateSelectedNodes, deleteSelectedNodes, setDeleteTarget]);

  return (
    <div className="w-full h-full relative">
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
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 }}
        fitView
        defaultEdgeOptions={{
          type: "deletable",
          style: { stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 },
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: BG_CANVAS_HEX }}
        // ── Multi-select via drag (marquee / selection box) ─────────────
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}  // only middle-click or right-click pans; left-drag selects
      >
        <Background
          variant={BackgroundVariant.Dots}
          color={CANVAS_DOT_COLOR}
          gap={20}
          size={1}
        />
        <Controls className="!bg-zinc-800 !border-zinc-700 !shadow-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-300 [&>button:hover]:!bg-zinc-700" />
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

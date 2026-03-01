"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type EdgeTypes,
  type NodeChange,
  type EdgeChange,
  type Connection,
  ConnectionLineType,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";
import { customAlphabet } from "nanoid";
import { useWorkflowStore } from "@/store/workflow-store";
import type { NodeType, WorkflowNode, WorkflowEdge, WorkflowNodeData } from "@/types/workflow";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Map as MapIcon, LayoutDashboard, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  BG_CANVAS_HEX,
  CANVAS_DOT_COLOR,
  CANVAS_EDGE_STROKE,
  MINIMAP_MASK_COLOR,
} from "@/lib/theme";
import { NODE_REGISTRY, NODE_TYPE_COMPONENTS, createNodeFromType } from "@/lib/node-registry";
import { NodeSize, NODE_SIZE_DIMENSIONS } from "@/nodes/shared/base-node";
import { DeletableEdge } from "@/components/edges/deletable-edge";
import { ContextMenu, type ContextMenuTarget } from "@/components/workflow/context-menu";
import { isModKey } from "@/lib/platform";
import { useSavedWorkflowsStore } from "@/store/library-store";
import type { SubAgentFlowNodeData } from "@/nodes/sub-agent-flow/types";
import { LibraryToggleButton, HelpMenu } from "./shared-header-actions";
import NodePalette from "./node-palette";
import CanvasToolbar from "./canvas-toolbar";
import DeleteDialog from "./delete-dialog";
import PropertiesPanel from "./properties-panel";
import LibraryPanel from "./library-panel";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

const edgeTypeComponents: EdgeTypes = { deletable: DeletableEdge };

// ── Default Start / End for fresh sub-workflows ─────────────────────────────
function createSubStartNode(): WorkflowNode {
  return {
    id: `start-sub-${nanoid(8)}`,
    type: "start",
    position: { x: 80, y: 200 },
    data: { type: "start", label: "Start", name: `start-sub-${nanoid(8)}` } as WorkflowNodeData,
    deletable: false,
  };
}
function createSubEndNode(): WorkflowNode {
  const id = `end-sub-${nanoid(8)}`;
  return {
    id,
    type: "end",
    position: { x: 600, y: 200 },
    data: { type: "end", label: "End", name: id } as WorkflowNodeData,
  };
}

interface CtxMenu { x: number; y: number; target: ContextMenuTarget; }

// ─────────────────────────────────────────────────────────────────────────────

interface SubWorkflowCanvasInnerProps { nodeId: string; }

function SubWorkflowCanvasInner({ nodeId }: SubWorkflowCanvasInnerProps) {
  const closeSubWorkflow = useWorkflowStore((s) => s.closeSubWorkflow);
  const updateSubWorkflowData = useWorkflowStore((s) => s.updateSubWorkflowData);
  const setSubWorkflowNodes = useWorkflowStore((s) => s.setSubWorkflowNodes);
  const subWorkflowStack = useWorkflowStore((s) => s.subWorkflowStack);
  const navigateToBreadcrumb = useWorkflowStore((s) => s.navigateToBreadcrumb);
  const workflowName = useWorkflowStore((s) => s.name);
  const minimapVisible = useWorkflowStore((s) => s.minimapVisible);
  const toggleMinimap = useWorkflowStore((s) => s.toggleMinimap);
  const canvasMode = useWorkflowStore((s) => s.canvasMode);
  const setCanvasMode = useWorkflowStore((s) => s.setCanvasMode);
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);


  // Read parent node data
  const parentNode = useWorkflowStore(
    useCallback((s) => s.nodes.find((n) => n.id === nodeId), [nodeId])
  );
  const parentData = parentNode?.data as SubAgentFlowNodeData | undefined;

  // ── Local state ─────────────────────────────────────────────────────────
  const [subNodes, setSubNodes] = useState<WorkflowNode[]>(() => {
    const initial = parentData?.subNodes ?? [];
    if (initial.length === 0) return [createSubStartNode(), createSubEndNode()];
    return initial;
  });
  const [subEdges, setSubEdges] = useState<WorkflowEdge[]>(parentData?.subEdges ?? []);

  // Keep refs in sync so callbacks never have stale closures
  const subNodesRef = useRef(subNodes);
  const subEdgesRef = useRef(subEdges);
  useEffect(() => { subNodesRef.current = subNodes; }, [subNodes]);
  useEffect(() => { subEdgesRef.current = subEdges; }, [subEdges]);

  // ── Sync back to parent (debounced) ─────────────────────────────────────
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncToParent = useCallback(
    (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        updateSubWorkflowData(nodeId, nodes, edges);
      }, 300);
    },
    [nodeId, updateSubWorkflowData]
  );

  // ── Sync local subNodes into the store so PropertiesPanel can find them ──
  useEffect(() => {
    setSubWorkflowNodes(subNodes);
  }, [subNodes, setSubWorkflowNodes]);

  // ── Listen for property-panel writes (store → local) ───────────────────
  useEffect(() => {
    let prevSubNodes = useWorkflowStore.getState().subWorkflowNodes;
    const unsub = useWorkflowStore.subscribe((state) => {
      const storeNodes = state.subWorkflowNodes;
      if (storeNodes === prevSubNodes || storeNodes.length === 0) {
        prevSubNodes = storeNodes;
        return;
      }
      prevSubNodes = storeNodes;
      // Only apply if data actually differs (avoid infinite loop)
      setSubNodes((prev) => {
        let changed = false;
        const next = prev.map((n) => {
          const updated = storeNodes.find((sn) => sn.id === n.id);
          if (updated && updated.data !== n.data) { changed = true; return updated; }
          return n;
        });
        if (!changed) return prev;
        syncToParent(next, subEdgesRef.current);
        return next;
      });
    });
    return unsub;
  }, [syncToParent]);


  // ── Drag tracking (suppress MiniMap) ────────────────────────────────────
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── React Flow callbacks ────────────────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      const hasDragStart = changes.some((c) => c.type === "position" && c.dragging === true);
      const hasDragEnd = changes.some((c) => c.type === "position" && c.dragging === false);
      if (hasDragStart && !isDraggingRef.current) { isDraggingRef.current = true; setIsDragging(true); }

      setSubNodes((prev) => {
        const next = applyNodeChanges(changes, prev) as WorkflowNode[];
        if (!isDraggingRef.current) syncToParent(next, subEdgesRef.current);
        return next;
      });

      if (hasDragEnd && isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        // Capture final positions
        setSubNodes((prev) => { syncToParent(prev, subEdgesRef.current); return prev; });
      }
    },
    [syncToParent]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setSubEdges((prev) => {
        const next = applyEdgeChanges(changes, prev);
        syncToParent(subNodesRef.current, next);
        return next;
      });
    },
    [syncToParent]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return;

      const currentNodes = subNodesRef.current;
      const sourceNode = currentNodes.find((n) => n.id === connection.source);
      const targetNode = currentNodes.find((n) => n.id === connection.target);

      // Skill → agent only
      if (sourceNode?.data?.type === "skill") {
        if (targetNode?.data?.type !== "agent") return;
        setSubEdges((prev) => {
          const next = addEdge({ ...connection, targetHandle: "skills", type: "deletable" }, prev);
          syncToParent(subNodesRef.current, next);
          return next;
        });
        return;
      }
      if (targetNode?.data?.type === "skill") return;
      if (connection.targetHandle === "skills") return;

      setSubEdges((prev) => {
        const filtered = prev.filter(
          (e) => !(e.source === connection.source && e.sourceHandle === connection.sourceHandle)
        );
        const next = addEdge({ ...connection, type: "deletable" }, filtered);
        syncToParent(subNodesRef.current, next);
        return next;
      });
    },
    [syncToParent]
  );

  // ── Node CRUD helpers ───────────────────────────────────────────────────
  const addSubNode = useCallback(
    (type: NodeType, position: { x: number; y: number }) => {
      if (type === "start") return;
      const newNode = createNodeFromType(type, position) as WorkflowNode;
      setSubNodes((prev) => {
        const next = [...prev, newNode];
        syncToParent(next, subEdgesRef.current);
        return next;
      });
    },
    [syncToParent]
  );

  const deleteSubNode = useCallback(
    (id: string) => {
      setSubNodes((prev) => {
        const target = prev.find((n) => n.id === id);
        if (!target || target.data?.type === "start") return prev;
        const next = prev.filter((n) => n.id !== id);
        setSubEdges((prevE) => {
          const nextE = prevE.filter((e) => e.source !== id && e.target !== id);
          syncToParent(next, nextE);
          return nextE;
        });
        return next;
      });
    },
    [syncToParent]
  );

  const duplicateSubNode = useCallback(
    (id: string) => {
      setSubNodes((prev) => {
        const node = prev.find((n) => n.id === id);
        if (!node || node.data?.type === "start") return prev;
        const newId = `${node.data.type}-${nanoid(8)}`;
        const dup: WorkflowNode = {
          ...node,
          id: newId,
          selected: true,
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          data: { ...node.data, name: newId } as WorkflowNodeData,
        };
        const next = [...prev.map((n) => ({ ...n, selected: false })), dup];
        syncToParent(next, subEdgesRef.current);
        return next;
      });
    },
    [syncToParent]
  );

  const deleteSelectedSubNodes = useCallback(() => {
    setSubNodes((prev) => {
      const toDelete = new Set(prev.filter((n) => n.selected && n.data?.type !== "start").map((n) => n.id));
      if (toDelete.size === 0) return prev;
      const next = prev.filter((n) => !toDelete.has(n.id)).map((n) => ({ ...n, selected: false }));
      setSubEdges((prevE) => {
        const nextE = prevE.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
        syncToParent(next, nextE);
        return nextE;
      });
      return next;
    });
  }, [syncToParent]);

  const duplicateSelectedSubNodes = useCallback(() => {
    setSubNodes((prev) => {
      const toDup = prev.filter((n) => n.selected && n.data?.type !== "start");
      if (toDup.length === 0) return prev;
      const idMap = new Map<string, string>();
      const newNodes = toDup.map((node) => {
        const newId = `${node.data.type}-${nanoid(8)}`;
        idMap.set(node.id, newId);
        return {
          ...node,
          id: newId,
          selected: true,
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          data: { ...node.data, name: newId } as WorkflowNodeData,
        };
      });
      const newEdges = subEdgesRef.current
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({ ...e, id: `${e.id}-${nanoid(8)}`, source: idMap.get(e.source)!, target: idMap.get(e.target)! }));
      const nextNodes = [...prev.map((n) => ({ ...n, selected: false })), ...newNodes];
      setSubEdges((prevE) => {
        const nextE = [...prevE, ...newEdges];
        syncToParent(nextNodes, nextE);
        return nextE;
      });
      return nextNodes;
    });
  }, [syncToParent]);

  // ── ReactFlow instance ──────────────────────────────────────────────────
  const { screenToFlowPosition, fitView } = useReactFlow();
  const nodeTypes = useMemo(() => NODE_TYPE_COMPONENTS, []);
  const edgeTypes = useMemo(() => edgeTypeComponents, []);

  const connectionLineType = edgeStyle === "smoothstep" ? ConnectionLineType.SmoothStep : ConnectionLineType.Bezier;

  // ── Auto-layout ─────────────────────────────────────────────────────────
  const autoLayout = useCallback(() => {
    const currentNodes = subNodesRef.current;
    const currentEdges = subEdgesRef.current;
    if (currentNodes.length === 0) return;

    const defaultDim = NODE_SIZE_DIMENSIONS[NodeSize.Medium];
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 200, marginx: 60, marginy: 60 });

    currentNodes.forEach((node) => {
      const entry = NODE_REGISTRY[node.type as NodeType];
      const dim = NODE_SIZE_DIMENSIONS[entry?.size ?? NodeSize.Medium] ?? defaultDim;
      g.setNode(node.id, { width: dim.width, height: dim.height });
    });
    currentEdges.forEach((edge) => g.setEdge(edge.source, edge.target));
    Dagre.layout(g);

    const targetPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach((node) => {
      const dn = g.node(node.id);
      if (dn) targetPositions[node.id] = { x: dn.x - dn.width / 2, y: dn.y - dn.height / 2 };
    });

    const duration = 400;
    const start = performance.now();
    const startPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach((node) => { startPositions[node.id] = { ...node.position }; });

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setSubNodes((prev) => {
        const next = prev.map((node) => {
          const from = startPositions[node.id];
          const to = targetPositions[node.id];
          if (!from || !to) return node;
          return { ...node, position: { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased } };
        });
        if (t >= 1) syncToParent(next, subEdgesRef.current);
        return next;
      });
      if (t < 1) requestAnimationFrame(animate);
      else setTimeout(() => fitView({ duration: 300, padding: 0.55 }), 50);
    };
    requestAnimationFrame(animate);
  }, [fitView, syncToParent]);

  useEffect(() => {
    const handler = () => autoLayout();
    window.addEventListener("nexus:auto-layout", handler);
    return () => window.removeEventListener("nexus:auto-layout", handler);
  }, [autoLayout]);

  // ── Context menu ────────────────────────────────────────────────────────
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
    setCtxMenu({ x: event.clientX, y: event.clientY, target: { kind: "selection" } });
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setCtxMenu({ x: (event as React.MouseEvent).clientX, y: (event as React.MouseEvent).clientY, target: { kind: "pane" } });
  }, []);

  const selectedCount = useMemo(() => subNodes.filter((n) => n.selected).length, [subNodes]);

  const handleCtxDelete = useCallback(() => {
    if (ctxMenu?.target.kind === "node") deleteSubNode(ctxMenu.target.nodeId);
  }, [ctxMenu, deleteSubNode]);

  const handleCtxDuplicate = useCallback(() => {
    if (ctxMenu?.target.kind === "node") duplicateSubNode(ctxMenu.target.nodeId);
  }, [ctxMenu, duplicateSubNode]);

  const handleCtxSaveToLibrary = useCallback(() => {
    const target = ctxMenu?.target;
    if (target?.kind === "node") {
      const node = subNodesRef.current.find((n) => n.id === target.nodeId);
      if (node?.data) {
        const { saveNodeToLib } = useSavedWorkflowsStore.getState();
        saveNodeToLib(node.data);
        toast.success(`"${node.data.label || node.data.type}" saved to library`);
      }
    }
  }, [ctxMenu]);

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
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addSubNode(type as NodeType, position);
    },
    [screenToFlowPosition, addSubNode]
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      const isMod = isModKey(e);
      const currentNodes = subNodesRef.current;
      const selected = currentNodes.filter((n) => n.selected);
      const multiSelected = selected.length > 1;
      const singleSelected = selected.length === 1 && selected[0].data?.type !== "start";

      // Escape → close sub-workflow
      if (e.key === "Escape") {
        e.preventDefault();
        // Flush sync before closing
        syncToParent(subNodesRef.current, subEdgesRef.current);
        setTimeout(() => closeSubWorkflow(), 50);
        return;
      }

      // H → Hand tool
      if (!isMod && !e.shiftKey && e.key.toLowerCase() === "h") { e.preventDefault(); setCanvasMode("hand"); return; }
      // V → Selection tool
      if (!isMod && !e.shiftKey && e.key.toLowerCase() === "v") { e.preventDefault(); setCanvasMode("selection"); return; }
      // Ctrl+Shift+L → Auto-layout
      if (isMod && e.shiftKey && e.key.toLowerCase() === "l") { e.preventDefault(); autoLayout(); return; }

      // Ctrl+D → duplicate
      if (isMod && e.key === "d") {
        e.preventDefault();
        if (multiSelected) duplicateSelectedSubNodes();
        else if (singleSelected) duplicateSubNode(selected[0].id);
        return;
      }

      // Delete / Backspace → delete
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (multiSelected) deleteSelectedSubNodes();
        else if (singleSelected) deleteSubNode(selected[0].id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSubWorkflow, setCanvasMode, autoLayout, duplicateSubNode, duplicateSelectedSubNodes, deleteSubNode, deleteSelectedSubNodes, syncToParent]);

  // ── Sync back on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      updateSubWorkflowData(nodeId, subNodesRef.current, subEdgesRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Memoize static props ────────────────────────────────────────────────
  const connectionLineStyle = useMemo(() => ({ stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 }), []);
  const defaultEdgeOptions = useMemo(() => ({ type: "deletable" as const, style: { stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 }, animated: false }), []);
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const rfStyle = useMemo(() => ({ backgroundColor: BG_CANVAS_HEX }), []);
  const panOnDrag = useMemo(() => (canvasMode === "hand" ? [0, 1, 2] : [1, 2]), [canvasMode]);
  const minimapNodeColor = useCallback(
    (node: { type?: string }) => NODE_REGISTRY[node.type as NodeType]?.accentHex ?? "#52525b",
    []
  );

  const onPaneClick = useCallback(() => {
    useWorkflowStore.getState().selectNode(null);
    closeMenu();
  }, [closeMenu]);
  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    useWorkflowStore.getState().selectNode(node.id);
  }, []);
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    useWorkflowStore.getState().openPropertiesPanel(node.id);
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-zinc-950">
      {/* Breadcrumb header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={closeSubWorkflow}
          className="gap-1.5 text-zinc-400 hover:text-zinc-100 h-8 px-2 shrink-0"
        >
          <ArrowLeft size={14} />
          Back
        </Button>
        <div className="h-4 w-px bg-zinc-700 shrink-0" />

        {/* Breadcrumb trail */}
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          {/* Root */}
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="text-sm text-zinc-400 hover:text-zinc-100 truncate max-w-[140px] transition-colors shrink-0"
          >
            {workflowName}
          </button>

          {/* Stack entries */}
          {subWorkflowStack.map((entry, idx) => {
            const isLast = idx === subWorkflowStack.length - 1;
            return (
              <div key={entry.nodeId} className="flex items-center gap-1 min-w-0">
                <ChevronRight size={12} className="text-zinc-600 shrink-0" />
                {isLast ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <LayoutDashboard size={12} className="text-purple-400 shrink-0" />
                    <span className="text-sm font-medium text-zinc-200 truncate">{entry.label}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => navigateToBreadcrumb(idx)}
                    className="text-sm text-zinc-400 hover:text-zinc-100 truncate max-w-[120px] transition-colors"
                  >
                    {entry.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-500 font-mono">{subNodes.length} nodes</span>
          <span className="text-[10px] text-zinc-500">·</span>
          <span className="text-[10px] text-zinc-500 font-mono">{subEdges.length} edges</span>

          <div className="h-4 w-px bg-zinc-700 mx-1" />

          <LibraryToggleButton variant="compact" />
          <HelpMenu />
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <ReactFlow
          nodes={subNodes}
          edges={subEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={onPaneClick}
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
          selectionOnDrag={canvasMode === "selection"}
          selectionMode={SelectionMode.Partial}
          panOnDrag={panOnDrag}
          panOnScroll={false}
          nodesDraggable={true}
        >
          <Background variant={BackgroundVariant.Dots} color={CANVAS_DOT_COLOR} gap={20} size={1} />
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
          <MapIcon size={16} />
        </Button>

        {/* Sub-workflow palette & toolbar */}
        <NodePalette />
        <CanvasToolbar />
        <DeleteDialog />
        <PropertiesPanel />
        <LibraryPanel />

        {/* Context menu */}
        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            target={ctxMenu.target}
            selectedCount={selectedCount}
            onClose={closeMenu}
            onDelete={ctxMenu.target.kind === "node" ? handleCtxDelete : undefined}
            onDuplicate={ctxMenu.target.kind === "node" ? handleCtxDuplicate : undefined}
            onDeleteSelected={selectedCount > 1 ? deleteSelectedSubNodes : undefined}
            onDuplicateSelected={selectedCount > 1 ? duplicateSelectedSubNodes : undefined}
            onSaveToLibrary={ctxMenu.target.kind === "node" ? handleCtxSaveToLibrary : undefined}
          />
        )}
      </div>
    </div>
  );
}

interface SubWorkflowCanvasProps { nodeId: string; }

export default function SubWorkflowCanvas({ nodeId }: SubWorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <SubWorkflowCanvasInner nodeId={nodeId} />
    </ReactFlowProvider>
  );
}


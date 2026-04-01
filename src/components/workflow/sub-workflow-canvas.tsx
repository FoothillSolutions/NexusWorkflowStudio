"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { customAlphabet } from "nanoid";
import { useWorkflowStore } from "@/store/workflow";
import type { NodeType, WorkflowNode, WorkflowEdge, WorkflowNodeData } from "@/types/workflow";
import type { LibraryItemEntry } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutDashboard, ChevronRight } from "lucide-react";
import { createNodeFromType } from "@/lib/node-registry";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import { LibraryToggleButton, HelpMenu, ConnectButton } from "./shared-header-actions";
import NodePalette from "./node-palette";
import CanvasToolbar from "./canvas-toolbar";
import PropertiesPanel from "./properties-panel";
import LibraryPanel from "./library-panel";
import { CanvasShell } from "./canvas-shell";
import { ContextMenu } from "./context-menu";
import { useDragTracking } from "@/hooks/use-drag-tracking";
import { useAutoLayout } from "@/hooks/use-auto-layout";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";
import { toast } from "sonner";
import { moveNodeIntoSubWorkflowContext } from "@/lib/subworkflow-transfer";
import { normalizeSubWorkflowContents } from "@/nodes/sub-workflow/constants";
import {
  copyNodesToWorkflowClipboard,
  hasWorkflowClipboardData,
  pasteNodesFromWorkflowClipboard,
} from "@/lib/workflow-clipboard";

const SUBWORKFLOW_HOVER_OPEN_DELAY_MS = 450;

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

interface SubWorkflowCanvasInnerProps { nodeId: string; }

function SubWorkflowCanvasInner({ nodeId }: SubWorkflowCanvasInnerProps) {
  const { screenToFlowPosition, getIntersectingNodes, fitView } = useReactFlow();
  const closeSubWorkflow = useWorkflowStore((s) => s.closeSubWorkflow);
  const openSubWorkflow = useWorkflowStore((s) => s.openSubWorkflow);
  const updateSubWorkflowData = useWorkflowStore((s) => s.updateSubWorkflowData);
  const deleteSubWorkflowNode = useWorkflowStore((s) => s.deleteSubWorkflowNode);
  const deleteSelectedSubWorkflowNodes = useWorkflowStore((s) => s.deleteSelectedSubWorkflowNodes);
  const setSubWorkflowNodes = useWorkflowStore((s) => s.setSubWorkflowNodes);
  const setSubWorkflowEdges = useWorkflowStore((s) => s.setSubWorkflowEdges);
  const setDeleteTarget = useWorkflowStore((s) => s.setDeleteTarget);
  const subWorkflowStack = useWorkflowStore((s) => s.subWorkflowStack);
  const navigateToBreadcrumb = useWorkflowStore((s) => s.navigateToBreadcrumb);
  const workflowName = useWorkflowStore((s) => s.name);
  const minimapVisible = useWorkflowStore((s) => s.minimapVisible);
  const toggleMinimap = useWorkflowStore((s) => s.toggleMinimap);
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);

  const parentNode = useWorkflowStore(
    useCallback((s) => {
      const fromParent = s.subWorkflowParentNodes.find((n) => n.id === nodeId);
      if (fromParent) return fromParent;
      return s.nodes.find((n) => n.id === nodeId);
    }, [nodeId])
  );
  const parentData = parentNode?.data as SubWorkflowNodeData | undefined;
  const defaultContentsRef = useRef(normalizeSubWorkflowContents(parentData));

  // Local state
  const [subNodes, setSubNodes] = useState<WorkflowNode[]>(() => {
    return defaultContentsRef.current.subNodes;
  });
  const [subEdges, setSubEdges] = useState<WorkflowEdge[]>(() => defaultContentsRef.current.subEdges);

  const subNodesRef = useRef(subNodes);
  const subEdgesRef = useRef(subEdges);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTargetRef = useRef<string | null>(null);
  useEffect(() => { subNodesRef.current = subNodes; }, [subNodes]);
  useEffect(() => { subEdgesRef.current = subEdges; }, [subEdges]);

  const clearSubWorkflowHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTargetRef.current = null;
  }, []);

  // Sync back to parent (debounced)
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

  const flushSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    updateSubWorkflowData(nodeId, subNodesRef.current, subEdgesRef.current);
  }, [nodeId, updateSubWorkflowData]);

  const handleCloseSubWorkflow = useCallback(() => {
    flushSync();
    closeSubWorkflow();
  }, [flushSync, closeSubWorkflow]);

  const handleNavigateToBreadcrumb = useCallback((index: number) => {
    flushSync();
    navigateToBreadcrumb(index);
  }, [flushSync, navigateToBreadcrumb]);

  useEffect(() => clearSubWorkflowHoverTimer, [clearSubWorkflowHoverTimer]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fitView({ duration: 250, maxZoom: 0.85, padding: 0.3 });
    });

    return () => cancelAnimationFrame(frame);
  }, [fitView, nodeId]);

  useEffect(() => {
    setSubWorkflowNodes(subNodes);
  }, [subNodes, setSubWorkflowNodes]);

  useEffect(() => {
    setSubWorkflowEdges(subEdges);
  }, [setSubWorkflowEdges, subEdges]);

  // Listen for property-panel writes (store → local)
  useEffect(() => {
    let prevSubNodes = useWorkflowStore.getState().subWorkflowNodes;
    return useWorkflowStore.subscribe((state) => {
      const storeNodes = state.subWorkflowNodes;
      if (storeNodes === prevSubNodes || storeNodes.length === 0) {
        prevSubNodes = storeNodes;
        return;
      }
      prevSubNodes = storeNodes;
      setSubNodes((prev) => {
        const hasStructuralChange =
          prev.length !== storeNodes.length ||
          prev.some((node) => !storeNodes.some((storeNode) => storeNode.id === node.id));
        if (hasStructuralChange) {
          return storeNodes;
        }

        let changed = false;
        const mappedNodes = prev.map((n) => {
          const updated = storeNodes.find((sn) => sn.id === n.id);
          if (updated && updated.data !== n.data) { changed = true; return updated; }
          return n;
        });
        if (!changed) return prev;
        syncToParent(mappedNodes, subEdgesRef.current);
        return mappedNodes;
      });
    });
  }, [syncToParent]);

  useEffect(() => {
    let prevSubEdges = useWorkflowStore.getState().subWorkflowEdges;
    return useWorkflowStore.subscribe((state) => {
      const storeEdges = state.subWorkflowEdges;
      if (storeEdges === prevSubEdges) return;
      prevSubEdges = storeEdges;
      subEdgesRef.current = storeEdges;
      setSubEdges((prev) => (prev === storeEdges ? prev : storeEdges));
    });
  }, []);

  // Drag tracking via shared hook
  const applySubNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      setSubNodes((prev) => applyNodeChanges(changes, prev) as WorkflowNode[]);
    },
    []
  );
  const { onNodesChange: wrappedOnNodesChange, isDragging, isDraggingRef } = useDragTracking(applySubNodesChange);

  // Wrap to sync on drag end
  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      const hasDragEnd = changes.some((c) => c.type === "position" && c.dragging === false);
      wrappedOnNodesChange(changes);
      if (hasDragEnd) {
        setSubNodes((prev) => { syncToParent(prev, subEdgesRef.current); return prev; });
      } else if (!isDraggingRef.current) {
        setSubNodes((prev) => { syncToParent(prev, subEdgesRef.current); return prev; });
      }
    },
    [wrappedOnNodesChange, syncToParent, isDraggingRef]
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

      if (sourceNode?.data?.type === "script") {
        if (targetNode?.data?.type !== "skill") return;
        setSubEdges((prev) => {
          const next = addEdge({ ...connection, sourceHandle: "script-out", targetHandle: "scripts", type: "deletable" }, prev);
          syncToParent(subNodesRef.current, next);
          return next;
        });
        return;
      }

      if (sourceNode?.data?.type === "skill") {
        if (targetNode?.data?.type !== "agent" && targetNode?.data?.type !== "parallel-agent") return;
        setSubEdges((prev) => {
          const next = addEdge({ ...connection, targetHandle: "skills", type: "deletable" }, prev);
          syncToParent(subNodesRef.current, next);
          return next;
        });
        return;
      }
      if (targetNode?.data?.type === "skill") {
        return;
      }
      if (connection.targetHandle === "skills") return;
      if (connection.targetHandle === "scripts") return;

      if (sourceNode?.data?.type === "document") {
        if (targetNode?.data?.type !== "agent" && targetNode?.data?.type !== "parallel-agent") return;
        setSubEdges((prev) => {
          const next = addEdge({ ...connection, targetHandle: "docs", type: "deletable" }, prev);
          syncToParent(subNodesRef.current, next);
          return next;
        });
        return;
      }
      if (targetNode?.data?.type === "document") return;
      if (connection.targetHandle === "docs") return;

      if (sourceNode?.data?.type === "parallel-agent" && connection.sourceHandle?.startsWith("branch-")) {
        if (targetNode?.data?.type !== "agent") return;
      }

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

  // Node CRUD helpers
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

  const copySubNode = useCallback((id: string) => {
    return copyNodesToWorkflowClipboard({
      nodes: subNodesRef.current,
      edges: subEdgesRef.current,
      nodeIds: [id],
    });
  }, []);

  const copySelectedSubNodes = useCallback(() => {
    return copyNodesToWorkflowClipboard({
      nodes: subNodesRef.current,
      edges: subEdgesRef.current,
    });
  }, []);

  const pasteSubNodes = useCallback((targetPosition?: { x: number; y: number }) => {
    const pasted = pasteNodesFromWorkflowClipboard({
      nodes: subNodesRef.current,
      edges: subEdgesRef.current,
      targetPosition,
    });
    if (!pasted) return 0;

    subNodesRef.current = pasted.nodes;
    subEdgesRef.current = pasted.edges;
    setSubNodes(pasted.nodes);
    setSubEdges(pasted.edges);
    setSubWorkflowNodes(pasted.nodes);
    syncToParent(pasted.nodes, pasted.edges);
    useWorkflowStore.setState({
      selectedNodeId: pasted.pastedNodeIds.length === 1 ? pasted.pastedNodeIds[0] : null,
      propertiesPanelOpen: false,
    });

    return pasted.pastedNodeIds.length;
  }, [setSubWorkflowNodes, syncToParent]);

  const moveSubNodeIntoNestedSubWorkflow = useCallback(
    (sourceNodeId: string, targetSubWorkflowNodeId: string) => {
      const result = moveNodeIntoSubWorkflowContext({
        nodes: subNodesRef.current,
        edges: subEdgesRef.current,
        sourceNodeId,
        targetSubWorkflowNodeId,
      });

      if (!result.moved) return false;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      subNodesRef.current = result.nodes;
      subEdgesRef.current = result.edges;
      setSubNodes(result.nodes);
      setSubEdges(result.edges);
      setSubWorkflowNodes(result.nodes);
      updateSubWorkflowData(nodeId, result.nodes, result.edges);

      return true;
    },
    [nodeId, setSubWorkflowNodes, updateSubWorkflowData]
  );

  const getHoveredSubWorkflowId = useCallback(
    (draggedNode: WorkflowNode) => {
      if (draggedNode.data?.type === "start") return null;

      const targetNode = (getIntersectingNodes(draggedNode, true) as WorkflowNode[])
        .find((node) => node.id !== draggedNode.id && node.data?.type === "sub-workflow");

      return targetNode?.id ?? null;
    },
    [getIntersectingNodes]
  );

  const onNodeDragStart = () => {
    clearSubWorkflowHoverTimer();
  };

  const onNodeDrag = (_event: React.MouseEvent, draggedNode: WorkflowNode) => {
    const hoveredSubWorkflowId = getHoveredSubWorkflowId(draggedNode);
    if (!hoveredSubWorkflowId) {
      clearSubWorkflowHoverTimer();
      return;
    }

    if (hoverTargetRef.current === hoveredSubWorkflowId) return;

    clearSubWorkflowHoverTimer();
    hoverTargetRef.current = hoveredSubWorkflowId;
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      const moved = moveSubNodeIntoNestedSubWorkflow(draggedNode.id, hoveredSubWorkflowId);
      hoverTargetRef.current = null;
      if (!moved) return;
      requestAnimationFrame(() => openSubWorkflow(hoveredSubWorkflowId));
    }, SUBWORKFLOW_HOVER_OPEN_DELAY_MS);
  };

  const onNodeDragStop = () => {
    clearSubWorkflowHoverTimer();
  };


  const handleLoadLibraryItem = useCallback(
    (item: LibraryItemEntry) => {
      if (item.nodeType === "start") {
        toast.error("Start nodes can’t be added inside a subworkflow");
        return;
      }

      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const newNode = createNodeFromType(item.nodeType, position) as WorkflowNode;
      const hydratedData = {
        ...newNode.data,
        ...item.nodeData,
        name: newNode.id,
        ...(item.nodeType === "sub-workflow"
          ? normalizeSubWorkflowContents(item.nodeData as Partial<SubWorkflowNodeData>)
          : {}),
      } as WorkflowNodeData;
      const hydratedNode: WorkflowNode = {
        ...newNode,
        data: hydratedData,
      };

      setSubNodes((prev) => {
        const next = [...prev, hydratedNode];
        syncToParent(next, subEdgesRef.current);
        return next;
      });
      toast.success(`"${item.name}" added to subworkflow`);
    },
    [screenToFlowPosition, syncToParent]
  );

  // Auto-layout via shared hook
  const autoLayout = useAutoLayout({
    getNodes: () => subNodesRef.current,
    getEdges: () => subEdgesRef.current,
    setNodes: setSubNodes,
    onComplete: (nodes) => syncToParent(nodes, subEdgesRef.current),
  });

  useEffect(() => {
    const handler = () => autoLayout();
    window.addEventListener("nexus:auto-layout", handler);
    return () => window.removeEventListener("nexus:auto-layout", handler);
  }, [autoLayout]);

  const setSubWorkflowDeleteTarget = useCallback(
    (target: { type: "node" | "edge" | "selection"; id: string }) => {
      setDeleteTarget({
        ...target,
        scope: "subworkflow",
        count:
          target.type === "selection"
            ? subNodesRef.current.filter((node) => node.selected && node.data?.type !== "start").length
            : undefined,
      });
    },
    [setDeleteTarget]
  );

  // Canvas interactions via shared hook
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
    addNode: addSubNode,
    deleteNode: deleteSubWorkflowNode,
    copyNode: copySubNode,
    copySelectedNodes: copySelectedSubNodes,
    duplicateNode: duplicateSubNode,
    duplicateSelectedNodes: duplicateSelectedSubNodes,
    deleteSelectedNodes: deleteSelectedSubWorkflowNodes,
    pasteNodes: pasteSubNodes,
    hasClipboardData: hasWorkflowClipboardData,
    setDeleteTarget: setSubWorkflowDeleteTarget,
    getNodes: () => subNodesRef.current,
    autoLayout,
    onEscape: handleCloseSubWorkflow,
    isSubWorkflow: true,
  });

  // Sync back on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      const current = useWorkflowStore.getState();
      if (current.activeSubWorkflowNodeId === nodeId) {
        updateSubWorkflowData(nodeId, subNodesRef.current, subEdgesRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {/* Breadcrumb header */}
      <div className="nexus-no-select flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCloseSubWorkflow}
          className="gap-1.5 text-zinc-400 hover:text-zinc-100 h-8 px-2 shrink-0"
        >
          <ArrowLeft size={14} />
          Back
        </Button>
        <div className="h-4 w-px bg-zinc-700 shrink-0" />

        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <button
            onClick={() => handleNavigateToBreadcrumb(-1)}
            className="text-sm text-zinc-400 hover:text-zinc-100 truncate max-w-35 transition-colors shrink-0"
          >
            {workflowName}
          </button>

          {subWorkflowStack.map((entry, idx) => {
            const isLast = idx === subWorkflowStack.length - 1;
            return (
              <div key={`${idx}-${entry.nodeId}`} className="flex items-center gap-1 min-w-0">
                <ChevronRight size={12} className="text-zinc-600 shrink-0" />
                {isLast ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <LayoutDashboard size={12} className="text-purple-400 shrink-0" />
                    <span className="text-sm font-medium text-zinc-200 truncate">{entry.label}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleNavigateToBreadcrumb(idx)}
                    className="text-sm text-zinc-400 hover:text-zinc-100 truncate max-w-30 transition-colors"
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
          <ConnectButton variant="compact" />
          <HelpMenu />
        </div>
      </div>

      {/* Canvas area */}
      <div
        className={`flex-1 relative overflow-hidden ${activeCanvasMode === "hand" ? "canvas-hand" : "canvas-selection"}`}
        onMouseMove={onCanvasMouseMove}
      >
        <CanvasShell
          nodes={subNodes}
          edges={subEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onSelectionContextMenu={onSelectionContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          canvasMode={activeCanvasMode}
          edgeStyle={edgeStyle}
          minimapVisible={minimapVisible}
          toggleMinimap={toggleMinimap}
          isDragging={isDragging}
          fitViewOnInit={false}
        />

        <NodePalette />
        <CanvasToolbar />
        <PropertiesPanel />
        <LibraryPanel onLoadItem={handleLoadLibraryItem} />

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
          />
        )}
      </div>
    </div>
  );
}

export default function SubWorkflowCanvas({ nodeId }: { nodeId: string }) {
  return (
    <ReactFlowProvider>
      <SubWorkflowCanvasInner nodeId={nodeId} />
    </ReactFlowProvider>
  );
}


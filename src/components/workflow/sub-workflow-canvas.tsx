"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { customAlphabet } from "nanoid";
import { useWorkflowStore } from "@/store/workflow-store";
import type { NodeType, WorkflowNode, WorkflowEdge, WorkflowNodeData } from "@/types/workflow";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutDashboard, ChevronRight } from "lucide-react";
import { createNodeFromType } from "@/lib/node-registry";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import { LibraryToggleButton, HelpMenu, ConnectButton } from "./shared-header-actions";
import NodePalette from "./node-palette";
import CanvasToolbar from "./canvas-toolbar";
import DeleteDialog from "./delete-dialog";
import PropertiesPanel from "./properties-panel";
import LibraryPanel from "./library-panel";
import { CanvasShell } from "./canvas-shell";
import { ContextMenu } from "./context-menu";
import { useDragTracking } from "@/hooks/use-drag-tracking";
import { useAutoLayout } from "@/hooks/use-auto-layout";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

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
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);

  const parentNode = useWorkflowStore(
    useCallback((s) => {
      const fromParent = s.subWorkflowParentNodes.find((n) => n.id === nodeId);
      if (fromParent) return fromParent;
      return s.nodes.find((n) => n.id === nodeId);
    }, [nodeId])
  );
  const parentData = parentNode?.data as SubWorkflowNodeData | undefined;

  // Local state
  const [subNodes, setSubNodes] = useState<WorkflowNode[]>(() => {
    const initial = parentData?.subNodes ?? [];
    if (initial.length === 0) return [createSubStartNode(), createSubEndNode()];
    return initial;
  });
  const [subEdges, setSubEdges] = useState<WorkflowEdge[]>(parentData?.subEdges ?? []);

  const subNodesRef = useRef(subNodes);
  const subEdgesRef = useRef(subEdges);
  useEffect(() => { subNodesRef.current = subNodes; }, [subNodes]);
  useEffect(() => { subEdgesRef.current = subEdges; }, [subEdges]);

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

  useEffect(() => {
    setSubWorkflowNodes(subNodes);
  }, [subNodes, setSubWorkflowNodes]);

  // Listen for property-panel writes (store → local)
  useEffect(() => {
    let prevSubNodes = useWorkflowStore.getState().subWorkflowNodes;
    const unsub = useWorkflowStore.subscribe((state) => {
      const storeNodes = state.subWorkflowNodes;
      if (storeNodes === prevSubNodes || storeNodes.length === 0) {
        prevSubNodes = storeNodes;
        return;
      }
      prevSubNodes = storeNodes;
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

  // Drag tracking via shared hook
  const applySubNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      setSubNodes((prev) => {
        const next = applyNodeChanges(changes, prev) as WorkflowNode[];
        return next;
      });
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

      if (sourceNode?.data?.type === "document") {
        if (targetNode?.data?.type !== "agent") return;
        setSubEdges((prev) => {
          const next = addEdge({ ...connection, targetHandle: "docs", type: "deletable" }, prev);
          syncToParent(subNodesRef.current, next);
          return next;
        });
        return;
      }
      if (targetNode?.data?.type === "document") return;
      if (connection.targetHandle === "docs") return;

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

  // Canvas interactions via shared hook
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
    addNode: addSubNode,
    deleteNode: deleteSubNode,
    duplicateNode: duplicateSubNode,
    duplicateSelectedNodes: duplicateSelectedSubNodes,
    deleteSelectedNodes: deleteSelectedSubNodes,
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
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm shrink-0">
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
            className="text-sm text-zinc-400 hover:text-zinc-100 truncate max-w-[140px] transition-colors shrink-0"
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
          <ConnectButton variant="compact" />
          <HelpMenu />
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
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
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onSelectionContextMenu={onSelectionContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          canvasMode={canvasMode}
          edgeStyle={edgeStyle}
          minimapVisible={minimapVisible}
          toggleMinimap={toggleMinimap}
          isDragging={isDragging}
        />

        <NodePalette />
        <CanvasToolbar />
        <DeleteDialog />
        <PropertiesPanel />
        <LibraryPanel />

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


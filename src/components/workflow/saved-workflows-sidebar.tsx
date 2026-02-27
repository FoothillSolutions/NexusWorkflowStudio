"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSavedWorkflowsStore } from "@/store/saved-workflows-store";
import { useWorkflowStore } from "@/store/workflow-store";
import type { SavedWorkflowEntry, LibraryItemEntry, LibraryCategory } from "@/lib/saved-workflows";
import { LIBRARY_CATEGORIES } from "@/lib/saved-workflows";
import type { NodeType } from "@/types/workflow";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  X,
  Save,
  Trash2,
  FolderOpen,
  Clock,
  Check,
  Pencil,
  Library,
  Search,
  Bot,
  Wrench,
  MessageSquare,
  Layers,
} from "lucide-react";
import {
  BORDER_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_SUBTLE,
  BG_CANVAS_HEX,
  BG_SURFACE,
  BORDER_DEFAULT,
  BG_ELEVATED,
} from "@/lib/theme";

// ── Category icons ──────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  all: Layers,
  workflow: Layers,
  agent: Bot,
  skill: Wrench,
  prompt: MessageSquare,
};

const CATEGORY_BG_ACTIVE: Record<string, string> = {
  all: "bg-zinc-700/50 text-zinc-100",
  workflow: "bg-blue-500/15 text-blue-300",
  agent: "bg-purple-500/15 text-purple-300",
  skill: "bg-amber-500/15 text-amber-300",
  prompt: "bg-emerald-500/15 text-emerald-300",
};

// ── Mini-map renderer (for workflows) ───────────────────────────────────────
function WorkflowMiniMap({ entry }: { entry: SavedWorkflowEntry }) {
  const nodes = entry.workflow.nodes;
  const edges = entry.workflow.edges;

  if (nodes.length === 0) {
    return (
      <div className="w-full h-20 rounded-t-lg bg-zinc-950 flex items-center justify-center">
        <span className={`text-xs ${TEXT_SUBTLE}`}>Empty workflow</span>
      </div>
    );
  }

  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const NODE_W = 160;
  const NODE_H = 40;
  const contentW = maxX - minX + NODE_W;
  const contentH = maxY - minY + NODE_H;

  const svgW = 260;
  const svgH = 80;
  const padding = 12;

  const scaleX = (svgW - padding * 2) / Math.max(contentW, 1);
  const scaleY = (svgH - padding * 2) / Math.max(contentH, 1);
  const scale = Math.min(scaleX, scaleY, 1.5);

  const scaledW = contentW * scale;
  const scaledH = contentH * scale;
  const offsetX = (svgW - scaledW) / 2;
  const offsetY = (svgH - scaledH) / 2;

  const toX = (x: number) => (x - minX) * scale + offsetX;
  const toY = (y: number) => (y - minY) * scale + offsetY;

  const nodeW = Math.max(NODE_W * scale * 0.6, 20);
  const nodeH = Math.max(NODE_H * scale * 0.5, 8);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      width="100%"
      height="80"
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="rounded-t-lg"
      style={{ backgroundColor: BG_CANVAS_HEX }}
    >
      {edges.map((edge) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return null;
        return (
          <line
            key={edge.id}
            x1={toX(src.position.x) + nodeW / 2}
            y1={toY(src.position.y) + nodeH / 2}
            x2={toX(tgt.position.x) + nodeW / 2}
            y2={toY(tgt.position.y) + nodeH / 2}
            stroke="#444"
            strokeWidth={1.5}
            opacity={0.6}
          />
        );
      })}
      {nodes.map((node) => {
        const nodeType = (node.data?.type ?? node.type) as NodeType;
        const color = NODE_REGISTRY[nodeType]?.accentHex ?? "#52525b";
        return (
          <rect
            key={node.id}
            x={toX(node.position.x)}
            y={toY(node.position.y)}
            width={nodeW}
            height={nodeH}
            rx={3}
            fill={color}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

// ── Node preview (for library items) ────────────────────────────────────────
function NodePreview({ item }: { item: LibraryItemEntry }) {
  const regEntry = NODE_REGISTRY[item.nodeType];
  const Icon = regEntry?.icon;
  const accentHex = regEntry?.accentHex ?? "#52525b";

  return (
    <div
      className="w-full h-20 rounded-t-lg flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: BG_CANVAS_HEX }}
    >
      {/* Accent glow */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(ellipse at center, ${accentHex} 0%, transparent 70%)`,
        }}
      />
      {/* Central node preview chip */}
      <div
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg border"
        style={{
          backgroundColor: `${accentHex}15`,
          borderColor: `${accentHex}40`,
        }}
      >
        {Icon && <Icon size={16} style={{ color: accentHex }} />}
        <span className="text-sm font-medium text-zinc-300 max-w-[160px] truncate">
          {item.name}
        </span>
      </div>
    </div>
  );
}

// ── Workflow card ────────────────────────────────────────────────────────────
function WorkflowCard({
  entry,
  onLoad,
  onUpdate,
  onDelete,
}: {
  entry: SavedWorkflowEntry;
  onLoad: (id: string) => void;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { rename } = useSavedWorkflowsStore();

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    setRenameValue(entry.name);
  }, [entry.name]);

  const startRenaming = useCallback(() => {
    setRenameValue(entry.name);
    setIsRenaming(true);
  }, [entry.name]);

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== entry.name) {
      rename(entry.id, trimmed);
      toast.success("Workflow renamed");
    }
    setIsRenaming(false);
  };

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(entry.updatedAt).getTime();
    const mins = Math.floor(diff / 60000);
    return mins < 1 ? "Just now" :
      mins < 60 ? `${mins}m ago` :
      mins < 1440 ? `${Math.floor(mins / 60)}h ago` :
      `${Math.floor(mins / 1440)}d ago`;
  }, [entry.updatedAt]);

  return (
    <div className={`group rounded-xl border ${BORDER_MUTED} bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-600 transition-all duration-200 overflow-hidden`}>
      <div className="relative">
        <div className="cursor-pointer" onClick={() => onLoad(entry.id)}>
          <WorkflowMiniMap entry={entry} />
        </div>
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => onLoad(entry.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-600/90 hover:bg-blue-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Load this workflow"
          >
            <FolderOpen size={10} /> Load
          </button>
          <button
            onClick={() => onUpdate(entry.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-600/90 hover:bg-emerald-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Overwrite with current workflow"
          >
            <Save size={10} /> Update
          </button>
          <button
            onClick={startRenaming}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-600/90 hover:bg-amber-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Rename"
          >
            <Pencil size={10} /> Rename
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-red-600/90 hover:bg-red-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Delete"
          >
            <Trash2 size={10} /> Delete
          </button>
        </div>
      </div>
      <div className="px-3 py-2">
        {isRenaming ? (
          <div className="flex items-center gap-1">
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              className={`text-xs font-medium ${TEXT_PRIMARY} bg-transparent border-b border-blue-500 outline-none w-full px-0.5`}
            />
            <button onClick={handleRename} className={`p-0.5 rounded hover:bg-zinc-700 ${TEXT_MUTED}`}>
              <Check size={11} />
            </button>
          </div>
        ) : (
          <div
            className={`text-sm font-medium ${TEXT_SECONDARY} truncate cursor-pointer hover:text-zinc-100 transition-colors`}
            onDoubleClick={startRenaming}
            title="Double-click to rename"
          >
            {entry.name}
          </div>
        )}
        <div className={`flex items-center gap-1.5 mt-1 text-xs ${TEXT_SUBTLE}`}>
          <Clock size={11} />
          <span>{timeAgo}</span>
          <span>·</span>
          <span>{entry.nodeCount} nodes</span>
        </div>
      </div>
    </div>
  );
}

// ── Library item card ───────────────────────────────────────────────────────
function LibraryItemCard({
  item,
  onLoad,
  onDelete,
}: {
  item: LibraryItemEntry;
  onLoad: (item: LibraryItemEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { renameLibraryItem: renameItem } = useSavedWorkflowsStore();

  const regEntry = NODE_REGISTRY[item.nodeType];
  const accentHex = regEntry?.accentHex ?? "#52525b";

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    setRenameValue(item.name);
  }, [item.name]);

  const startRenaming = useCallback(() => {
    setRenameValue(item.name);
    setIsRenaming(true);
  }, [item.name]);

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== item.name) {
      renameItem(item.id, trimmed);
      toast.success("Item renamed");
    }
    setIsRenaming(false);
  };

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(item.updatedAt).getTime();
    const mins = Math.floor(diff / 60000);
    return mins < 1 ? "Just now" :
      mins < 60 ? `${mins}m ago` :
      mins < 1440 ? `${Math.floor(mins / 60)}h ago` :
      `${Math.floor(mins / 1440)}d ago`;
  }, [item.updatedAt]);

  const categoryLabel = LIBRARY_CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category;

  return (
    <div className={`group rounded-xl border ${BORDER_MUTED} bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-600 transition-all duration-200 overflow-hidden`}>
      <div className="relative">
        <div className="cursor-pointer" onClick={() => onLoad(item)}>
          <NodePreview item={item} />
        </div>
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => onLoad(item)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-600/90 hover:bg-blue-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Add to canvas"
          >
            <FolderOpen size={10} /> Load
          </button>
          <button
            onClick={startRenaming}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-600/90 hover:bg-amber-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Rename"
          >
            <Pencil size={10} /> Rename
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-red-600/90 hover:bg-red-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Delete"
          >
            <Trash2 size={10} /> Delete
          </button>
        </div>
        {/* Category badge */}
        <div
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[11px] font-medium backdrop-blur-sm"
          style={{
            backgroundColor: `${accentHex}20`,
            color: accentHex,
            border: `1px solid ${accentHex}30`,
          }}
        >
          {categoryLabel}
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: accentHex }}
          />
          {isRenaming ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                className={`text-sm font-medium ${TEXT_PRIMARY} bg-transparent border-b border-blue-500 outline-none w-full px-0.5`}
              />
              <button onClick={handleRename} className={`p-0.5 rounded hover:bg-zinc-700 ${TEXT_MUTED}`}>
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div
              className={`text-sm font-medium ${TEXT_SECONDARY} truncate cursor-pointer hover:text-zinc-100 transition-colors flex-1 min-w-0`}
              onDoubleClick={startRenaming}
              title="Double-click to rename"
            >
              {item.name}
            </div>
          )}
        </div>
        {item.description && (
          <p className={`text-xs ${TEXT_SUBTLE} mt-1 line-clamp-1 pl-3`}>
            {item.description}
          </p>
        )}
        <div className={`flex items-center gap-1.5 mt-1 text-xs ${TEXT_SUBTLE} pl-3`}>
          <Clock size={11} />
          <span>{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ category }: { category: LibraryCategory | "all" }) {
  const Icon = CATEGORY_ICONS[category] ?? Layers;
  const label = LIBRARY_CATEGORIES.find((c) => c.value === category)?.label ?? "items";
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center mb-3">
        <Icon size={20} className={TEXT_SUBTLE} />
      </div>
      <p className={`text-sm font-medium ${TEXT_MUTED}`}>
        No {category === "all" ? "items" : label.toLowerCase()} saved
      </p>
      <p className={`text-xs ${TEXT_SUBTLE} mt-1 max-w-[240px]`}>
        {category === "workflow" || category === "all"
          ? "Save workflows via the header, or right-click nodes to save them to the library"
          : "Right-click a node on the canvas and select \"Save to Library\""}
      </p>
    </div>
  );
}

// ── Main sidebar component ──────────────────────────────────────────────────
export default function SavedWorkflowsSidebar() {
  const {
    entries,
    libraryItems,
    activeCategory,
    sidebarOpen,
    closeSidebar,
    remove,
    load,
    removeLibraryItem: removeLibItem,
    setActiveCategory,
  } = useSavedWorkflowsStore();

  const { getWorkflowJSON, loadWorkflow, addNode } = useWorkflowStore();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: "workflow" | "item"; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleLoad = useCallback(
    (id: string) => {
      const data = load(id);
      if (data) {
        loadWorkflow(data);
        toast.success("Workflow loaded");
      } else {
        toast.error("Failed to load workflow");
      }
    },
    [load, loadWorkflow]
  );

  const handleLoadItem = useCallback(
    (item: LibraryItemEntry) => {
      // Place the node at center of the current viewport
      const viewport = useWorkflowStore.getState().viewport;
      const centerX = (-viewport.x + 500) / viewport.zoom;
      const centerY = (-viewport.y + 300) / viewport.zoom;
      addNode(item.nodeType, { x: centerX, y: centerY });
      // After adding, update the latest node with the saved data
      const state = useWorkflowStore.getState();
      const latestNode = state.nodes[state.nodes.length - 1];
      if (latestNode) {
        state.updateNodeData(latestNode.id, { ...item.nodeData, name: latestNode.id });
      }
      toast.success(`"${item.name}" added to canvas`);
    },
    [addNode]
  );

  const handleDeleteWorkflow = useCallback((id: string) => {
    const entry = useSavedWorkflowsStore.getState().entries.find((e) => e.id === id);
    setConfirmDelete({ id, type: "workflow", name: entry?.name ?? "Unknown" });
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    const item = useSavedWorkflowsStore.getState().libraryItems.find((e) => e.id === id);
    setConfirmDelete({ id, type: "item", name: item?.name ?? "Unknown" });
  }, []);

  const executeDelete = useCallback(() => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "workflow") {
      remove(confirmDelete.id);
    } else {
      removeLibItem(confirmDelete.id);
    }
    setConfirmDelete(null);
    toast.success("Deleted successfully");
  }, [confirmDelete, remove, removeLibItem]);

  const handleUpdate = useCallback(
    (id: string) => {
      const json = getWorkflowJSON();
      useSavedWorkflowsStore.getState().save(json, id);
      toast.success("Workflow updated");
    },
    [getWorkflowJSON]
  );

  // Filter items based on active category and search
  const filteredWorkflows = useMemo(() => {
    if (activeCategory !== "all" && activeCategory !== "workflow") return [];
    return entries.filter((e) =>
      !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [entries, activeCategory, searchQuery]);

  const filteredItems = useMemo(() => {
    let items = libraryItems;
    if (activeCategory !== "all") {
      items = items.filter((i) => i.category === activeCategory);
    }
    if (searchQuery) {
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return items;
  }, [libraryItems, activeCategory, searchQuery]);

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: entries.length + libraryItems.length, workflow: entries.length };
    for (const item of libraryItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [entries, libraryItems]);

  const hasItems = filteredWorkflows.length > 0 || filteredItems.length > 0;

  return (
    <>
      <div
        className={`absolute top-4 right-4 z-20 flex flex-col w-[380px] rounded-2xl border border-zinc-700/50 bg-zinc-900/90 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300 ease-out ${
          sidebarOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
        style={{ maxHeight: "calc(100vh - 112px)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-700/50 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <Library className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="flex flex-col flex-1 min-w-0 gap-0">
            <span className="text-sm font-semibold text-zinc-100">Library</span>
            <span className={`text-xs ${TEXT_SUBTLE}`}>
              {categoryCounts.all} item{categoryCounts.all !== 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSidebar}
            className={`h-7 w-7 rounded-lg ${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0`}
          >
            <X size={14} />
          </Button>
        </div>

        {/* ── Search ── */}
        <div className="px-3 pt-2.5 pb-1.5 shrink-0">
          <div className="relative">
            <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${TEXT_SUBTLE}`} />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-8 pl-8 pr-3 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-sm ${TEXT_SECONDARY} placeholder:text-zinc-500 outline-none focus:border-zinc-600 transition-colors`}
            />
          </div>
        </div>

        {/* ── Category pills ── */}
        <div className="px-3 py-2 shrink-0">
          <div className="flex flex-wrap gap-1">
            {LIBRARY_CATEGORIES.map(({ value, label }) => {
              const isActive = activeCategory === value;
              const Icon = CATEGORY_ICONS[value] ?? Layers;
              const count = categoryCounts[value] ?? 0;
              return (
                <button
                  key={value}
                  onClick={() => setActiveCategory(value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? CATEGORY_BG_ACTIVE[value]
                      : `text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50`
                  }`}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                  {count > 0 && (
                    <span className={`ml-0.5 px-1 py-px rounded text-[10px] ${
                      isActive ? "bg-white/10" : "bg-zinc-800"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-zinc-700/30 mx-3" />

        {/* ── Content ── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-2">
            {!hasItems && <EmptyState category={activeCategory} />}

            {/* Workflows section */}
            {filteredWorkflows.length > 0 && (
              <>
                {activeCategory === "all" && (
                  <div className="flex items-center gap-1.5 px-1 pt-1 pb-0.5">
                    <Layers size={12} className="text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      Workflows
                    </span>
                    <span className={`text-[11px] ${TEXT_SUBTLE}`}>({filteredWorkflows.length})</span>
                  </div>
                )}
                {filteredWorkflows.map((entry) => (
                  <WorkflowCard
                    key={entry.id}
                    entry={entry}
                    onLoad={handleLoad}
                    onUpdate={handleUpdate}
                    onDelete={handleDeleteWorkflow}
                  />
                ))}
              </>
            )}

            {/* Library items section */}
            {filteredItems.length > 0 && (
              <>
                {activeCategory === "all" && filteredWorkflows.length > 0 && (
                  <div className="border-t border-zinc-700/30 mt-2 pt-2" />
                )}
                {activeCategory === "all" && (
                  <div className="flex items-center gap-1.5 px-1 pt-1 pb-0.5">
                    <Wrench size={12} className="text-purple-400" />
                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                      Components
                    </span>
                    <span className={`text-[11px] ${TEXT_SUBTLE}`}>({filteredItems.length})</span>
                  </div>
                )}
                {filteredItems.map((item) => (
                  <LibraryItemCard
                    key={item.id}
                    item={item}
                    onLoad={handleLoadItem}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent className={`${BG_SURFACE} ${BORDER_DEFAULT} ${TEXT_PRIMARY}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {confirmDelete?.type === "workflow" ? "workflow" : "item"}?</AlertDialogTitle>
            <AlertDialogDescription className={TEXT_MUTED}>
              {confirmDelete && (
                <>
                  <span className="font-medium text-zinc-200">
                    &ldquo;{confirmDelete.name}&rdquo;
                  </span>{" "}
                  will be permanently removed. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={`${BG_ELEVATED} ${TEXT_SECONDARY} ${BORDER_MUTED} hover:bg-zinc-700 hover:text-zinc-100`}
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={executeDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


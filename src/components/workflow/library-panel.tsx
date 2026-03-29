"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSavedWorkflowsStore } from "@/store/library-store";
import { useWorkflowStore } from "@/store/workflow-store";
import type { SavedWorkflowEntry, LibraryItemEntry, LibraryCategory } from "@/lib/library";
import { LIBRARY_CATEGORIES } from "@/lib/library";
import type { NodeType, WorkflowNodeData } from "@/types/workflow";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { NODE_ACCENT } from "@/lib/node-colors";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import { normalizeSubWorkflowContents } from "@/nodes/sub-workflow/constants";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  X,
  Save,
  Trash2,
  FolderOpen,
  Clock,
  Check,
  Pencil,
  Folders,
  Search,
  Bot,
  Wrench,
  MessageSquare,
  FileCode2,
  Layers,
  LayoutGrid,
  GitBranch,
  FileText,
} from "lucide-react";
import {
  BORDER_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_SUBTLE,
  BG_CANVAS_HEX,
} from "@/lib/theme";
import type { WorkflowJSON } from "@/types/workflow";

// ── Category config ─────────────────────────────────────────────────────────
/** Format an ISO timestamp as a human-readable relative time string. */
function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  return mins < 1 ? "Just now" :
    mins < 60 ? `${mins}m ago` :
    mins < 1440 ? `${Math.floor(mins / 60)}h ago` :
    `${Math.floor(mins / 1440)}d ago`;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  all: LayoutGrid,
  workflow: GitBranch,
  agent: Bot,
  skill: Wrench,
  document: FileText,
  prompt: MessageSquare,
  script: FileCode2,
};

/** Hex accent pulled straight from the centralized node-colors */
const CATEGORY_ACCENT_HEX: Record<string, string | null> = {
  all: null,
  workflow: NODE_ACCENT["sub-workflow"],
  prompt: NODE_ACCENT.prompt,
  script: NODE_ACCENT.script,
  agent: NODE_ACCENT.agent,
  skill: NODE_ACCENT.skill,
  document: NODE_ACCENT.document,
};


// ── Mini-map renderer (for workflows) ───────────────────────────────────────
function WorkflowMiniMap({ entry }: { entry: SavedWorkflowEntry }) {
  const nodes = entry.workflow.nodes;
  const edges = entry.workflow.edges;

  if (nodes.length === 0) {
    return (
      <div className="w-full h-24 rounded-t-lg bg-zinc-950 flex items-center justify-center">
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

  const svgW = 280;
  const svgH = 96;
  const padding = 14;

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
      height="96"
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
      className="w-full h-24 rounded-t-lg flex items-center justify-center relative overflow-hidden"
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
        <span className="text-sm font-medium text-zinc-300 max-w-40 truncate">
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

  const timeAgo = formatTimeAgo(entry.updatedAt);

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
      <div className="px-3.5 py-2.5">
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
        <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${TEXT_SUBTLE}`}>
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

  const timeAgo = formatTimeAgo(item.updatedAt);

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
      <div className="px-3.5 py-2.5">
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
          <p className={`text-xs ${TEXT_SUBTLE} mt-1.5 line-clamp-1 pl-3`}>
            {item.description}
          </p>
        )}
        <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${TEXT_SUBTLE} pl-3`}>
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
      <p className={`text-xs ${TEXT_SUBTLE} mt-1 max-w-60`}>
        {category === "workflow" || category === "all"
          ? "Save workflows via the header, or right-click nodes to save them to the library"
          : "Right-click a node on the canvas and select \"Save to Library\""}
      </p>
    </div>
  );
}

// ── Main sidebar component ──────────────────────────────────────────────────
interface LibraryPanelProps {
  onLoadWorkflow?: (workflow: WorkflowJSON, entryId: string) => void;
  onLoadItem?: (item: LibraryItemEntry) => void;
}

export default function LibraryPanel({ onLoadWorkflow, onLoadItem }: LibraryPanelProps) {
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

  const getWorkflowJSON = useWorkflowStore((s) => s.getWorkflowJSON);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const addNode = useWorkflowStore((s) => s.addNode);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: "workflow" | "item"; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleLoad = useCallback(
    (id: string) => {
      const data = load(id);
      if (data) {
        if (onLoadWorkflow) {
          onLoadWorkflow(data, id);
        } else {
          loadWorkflow(data, { savedToLibrary: true });
        }
        window.dispatchEvent(new CustomEvent("nexus:fit-view"));
        toast.success("Workflow loaded");
      } else {
        toast.error("Failed to load workflow");
      }
    },
    [load, loadWorkflow, onLoadWorkflow]
  );

  const handleLoadItem = useCallback(
    (item: LibraryItemEntry) => {
      if (onLoadItem) {
        onLoadItem(item);
        return;
      }

      // Place the node at center of the current viewport
      const viewport = useWorkflowStore.getState().viewport;
      const centerX = (-viewport.x + 500) / viewport.zoom;
      const centerY = (-viewport.y + 300) / viewport.zoom;
      const existingNodeIds = new Set(useWorkflowStore.getState().nodes.map((node) => node.id));
      addNode(item.nodeType, { x: centerX, y: centerY });
      const state = useWorkflowStore.getState();
      const insertedNode = state.nodes.find((node) => !existingNodeIds.has(node.id));
      if (!insertedNode) {
        toast.error(`Unable to add \"${item.name}\" to the canvas`);
        return;
      }

      const normalizedNodeData = {
        ...item.nodeData,
        name: insertedNode.id,
        ...(item.nodeType === "sub-workflow"
          ? normalizeSubWorkflowContents(item.nodeData as Partial<SubWorkflowNodeData>)
          : {}),
      } as Partial<WorkflowNodeData>;

      state.updateNodeData(insertedNode.id, normalizedNodeData);
      toast.success(`"${item.name}" added to canvas`);
    },
    [addNode, onLoadItem]
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
        className={`absolute top-4 right-4 z-20 flex flex-col rounded-2xl border border-zinc-700/50 bg-zinc-900/90 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300 ease-out ${
          sidebarOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
        style={{ width: "min(420px, calc(100vw - 32px))", maxHeight: "calc(100vh - 112px)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-700/50 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 bg-linear-to-br from-blue-500/20 to-purple-500/20">
            <Folders className="h-3.5 w-3.5 text-blue-400" />
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
              className={`w-full h-9 pl-8 pr-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-sm ${TEXT_SECONDARY} placeholder:text-zinc-500 outline-none focus:border-zinc-600 transition-colors`}
            />
          </div>
        </div>

        {/* ── Category tabs (icon-only, label appears on select) ── */}
        <div className="px-3 py-2.5 shrink-0">
          <div className="flex items-center gap-1 w-full bg-zinc-950/70 border border-zinc-700/50 rounded-xl p-1">
            {LIBRARY_CATEGORIES.map(({ value, label }) => {
              const isActive = activeCategory === value;
              const count = categoryCounts[value] ?? 0;
              const Icon = CATEGORY_ICONS[value] ?? LayoutGrid;
              const hex = CATEGORY_ACCENT_HEX[value] ?? null;
              return (
                <button
                  key={value}
                  onClick={() => setActiveCategory(value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out cursor-pointer ${
                    isActive
                      ? "shadow-sm px-3 py-1.5"
                      : `${TEXT_SUBTLE} hover:text-zinc-300 hover:bg-zinc-800/50 py-1.5`
                  }`}
                  style={isActive ? {
                    backgroundColor: hex ? `${hex}18` : "rgba(63,63,70,0.7)",
                    color: hex ?? "#e4e4e7",
                  } : undefined}
                >
                  <Icon size={13} className="shrink-0" />
                  <span
                    className="overflow-hidden transition-all duration-200 ease-out whitespace-nowrap"
                    style={{
                      maxWidth: isActive ? "80px" : "0px",
                      opacity: isActive ? 1 : 0,
                    }}
                  >
                    {label}
                  </span>
                  {count > 0 && (
                    <span className={`text-[10px] min-w-3.5 text-center transition-opacity duration-200 ${isActive ? "opacity-50" : "opacity-40"}`}>
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
        <ScrollArea className="flex-1 min-h-0" viewportClassName="overscroll-contain">
          <div className="p-3.5 space-y-2.5">
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
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        tone="danger"
        title={`Delete this ${confirmDelete?.type === "workflow" ? "workflow" : "item"}?`}
        description={confirmDelete ? (
          <>
            <span className="font-medium text-zinc-200">
              &ldquo;{confirmDelete.name}&rdquo;
            </span>{" "}
            will be permanently removed. This action cannot be undone.
          </>
        ) : undefined}
        confirmLabel="Delete"
        onConfirm={executeDelete}
      />
    </>
  );
}


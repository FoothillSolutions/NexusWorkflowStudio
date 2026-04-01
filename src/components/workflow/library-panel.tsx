"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSavedWorkflowsStore } from "@/store/library-store";
import { useWorkflowStore } from "@/store/workflow-store";
import type { SavedWorkflowEntry, LibraryItemEntry, LibraryCategory } from "@/lib/library";
import { LIBRARY_CATEGORIES } from "@/lib/library";
import type { MarketplaceLibraryItem, MarketplaceWorkflowEntry } from "@/lib/marketplace/types";
import type { NodeType, WorkflowNodeData } from "@/types/workflow";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { NODE_ACCENT } from "@/lib/node-colors";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import { normalizeSubWorkflowContents } from "@/nodes/sub-workflow/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  X,
  Save,
  Trash2,
  FolderOpen,
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
  RefreshCw,
  Store,
  Package,
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
import { cn } from "@/lib/utils";

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

const PANEL_SHELL_CLASS = "absolute top-4 right-4 z-20 flex min-h-0 flex-col overflow-hidden rounded-3xl border border-zinc-700/60 bg-zinc-950/88 shadow-[0_16px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all duration-300 ease-out";
const PANEL_SURFACE_CLASS = "rounded-2xl border border-zinc-800/80 bg-zinc-900/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const CARD_CLASS = `group rounded-2xl border ${BORDER_MUTED} bg-zinc-900/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 hover:border-zinc-600/80 hover:bg-zinc-900/80`;
const META_BADGE_CLASS = "rounded-full border border-zinc-700/60 bg-zinc-950/70 px-2 py-0.5 text-[11px] font-medium text-zinc-400";

function cardIconButtonClass(tone: "default" | "danger" = "default") {
  return cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-zinc-950/70 text-zinc-500 transition-all duration-150",
    tone === "danger"
      ? "hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
      : "hover:border-zinc-700/70 hover:bg-zinc-800/80 hover:text-zinc-100",
  );
}

function CardIconButton({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cardIconButtonClass(tone)}
      title={label}
      aria-label={label}
    >
      <Icon size={14} />
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  count,
  accentClass,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  accentClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg border border-current/10 bg-current/10", accentClass)}>
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">{label}</div>
        </div>
      </div>
      <Badge variant="outline" className="rounded-full border-zinc-700/70 bg-zinc-950/70 px-2 py-0 text-[10px] font-medium text-zinc-400">
        {count}
      </Badge>
    </div>
  );
}


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
      className="rounded-xl"
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
      className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl"
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
        className="relative flex max-w-[85%] items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.18)]"
        style={{
          backgroundColor: `${accentHex}15`,
          borderColor: `${accentHex}40`,
        }}
      >
        {Icon && <Icon size={15} style={{ color: accentHex }} />}
        <span className="max-w-full truncate text-xs font-medium text-zinc-300 sm:text-sm">
          {item.name}
        </span>
      </div>
    </div>
  );
}

// ── Marketplace source badges ────────────────────────────────────────────────
function MarketplaceSourceBadge({ pluginName, marketplaceName }: { pluginName: string; marketplaceName: string }) {
  const isNexus = pluginName === "_nexus";

  return (
    <>
      <span
        className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300"
        title={`Marketplace: ${marketplaceName}`}
      >
        <Store size={9} />
        {marketplaceName}
      </span>
      {!isNexus && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300"
          title={`Plugin: ${pluginName}`}
        >
          <Package size={9} />
          {pluginName}
        </span>
      )}
    </>
  );
}

// ── Workflow card ────────────────────────────────────────────────────────────
function WorkflowCard({
  entry,
  onLoad,
  onUpdate,
  onDelete,
  readonly = false,
  marketplaceInfo,
}: {
  entry: SavedWorkflowEntry;
  onLoad: (id: string) => void;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
  readonly?: boolean;
  marketplaceInfo?: { marketplaceName: string; pluginName: string };
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
    <div className={CARD_CLASS}>
      <button type="button" className="block w-full p-2 text-left" onClick={() => onLoad(entry.id)}>
        <div className="relative overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-950/90">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-violet-500/10 via-blue-500/5 to-transparent" />
          <WorkflowMiniMap entry={entry} />
        </div>
      </button>

      <div className="px-3.5 pb-3.5 pt-1.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <div className="flex items-center gap-1.5">
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
                  className={`h-8 w-full rounded-lg border border-blue-500/40 bg-zinc-950/70 px-2.5 text-sm font-medium ${TEXT_PRIMARY} outline-none transition-colors focus:border-blue-400`}
                />
                <button onClick={handleRename} className={`rounded-lg p-1.5 hover:bg-zinc-800 ${TEXT_MUTED}`}>
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`min-w-0 max-w-full truncate text-left text-sm font-semibold ${TEXT_SECONDARY} transition-colors hover:text-zinc-100`}
                onDoubleClick={readonly ? undefined : startRenaming}
                onClick={() => onLoad(entry.id)}
                title="Open workflow"
              >
                {entry.name}
              </button>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={META_BADGE_CLASS}>Updated {timeAgo}</span>
              <span className={META_BADGE_CLASS}>{entry.nodeCount} nodes</span>
              <span className={META_BADGE_CLASS}>{entry.edgeCount} edges</span>
              {marketplaceInfo && (
                <MarketplaceSourceBadge pluginName={marketplaceInfo.pluginName} marketplaceName={marketplaceInfo.marketplaceName} />
              )}
            </div>
          </div>

          {!readonly && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <CardIconButton icon={Pencil} label="Rename workflow" onClick={startRenaming} />
              <CardIconButton icon={Trash2} label="Delete workflow" onClick={() => onDelete(entry.id)} tone="danger" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLoad(entry.id)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-500/20 hover:text-blue-100"
            title="Load this workflow"
          >
            <FolderOpen size={12} />
            Open
          </button>
          {!readonly && (
            <button
              type="button"
              onClick={() => onUpdate(entry.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-700/70 bg-zinc-950/70 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-200"
              title="Overwrite with current workflow"
            >
              <Save size={12} />
              Update
            </button>
          )}
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
  readonly = false,
  marketplaceInfo,
}: {
  item: LibraryItemEntry;
  onLoad: (item: LibraryItemEntry) => void;
  onDelete: (id: string) => void;
  readonly?: boolean;
  marketplaceInfo?: { marketplaceName: string; pluginName: string };
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

  return (
    <div className={CARD_CLASS}>
      <button type="button" className="block w-full p-2 text-left" onClick={() => onLoad(item)}>
        <div className="relative overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-950/90">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ background: `radial-gradient(circle at top, ${accentHex} 0%, transparent 65%)` }}
          />
          <NodePreview item={item} />
        </div>
      </button>

      <div className="px-3 pb-3 pt-1.5">
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <div className="flex items-center gap-1.5">
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
                  className={`h-8 w-full rounded-lg border border-blue-500/40 bg-zinc-950/70 px-2.5 text-sm font-medium ${TEXT_PRIMARY} outline-none transition-colors focus:border-blue-400`}
                />
                <button onClick={handleRename} className={`rounded-lg p-1.5 hover:bg-zinc-800 ${TEXT_MUTED}`}>
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className={`min-w-0 max-w-full truncate text-left text-sm font-semibold ${TEXT_SECONDARY} transition-colors hover:text-zinc-100`}
                  onDoubleClick={startRenaming}
                  onClick={() => onLoad(item)}
                  title="Add item to canvas"
                >
                  {item.name}
                </button>
              </div>
            )}

            {item.description && (
              <p className={`mt-1 line-clamp-2 text-xs leading-4.5 ${TEXT_SUBTLE}`}>
                {item.description}
              </p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
              <span>Updated {timeAgo}</span>
            </div>
          </div>

          {!readonly && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <CardIconButton icon={Pencil} label="Rename item" onClick={startRenaming} />
              <CardIconButton icon={Trash2} label="Delete item" onClick={() => onDelete(item.id)} tone="danger" />
            </div>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onLoad(item)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-500/20 hover:text-blue-100"
            title="Add to canvas"
          >
            <FolderOpen size={12} />
            Add
          </button>
          {marketplaceInfo && (
            <MarketplaceSourceBadge pluginName={marketplaceInfo.pluginName} marketplaceName={marketplaceInfo.marketplaceName} />
          )}
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
    <div className={`flex flex-col items-center justify-center border border-dashed border-zinc-700/60 bg-zinc-900/35 px-6 py-10 text-center ${PANEL_SURFACE_CLASS}`}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-700/60 bg-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <Icon size={18} className={TEXT_SUBTLE} />
      </div>
      <p className={`text-sm font-semibold ${TEXT_MUTED}`}>
        No {category === "all" ? "items" : label.toLowerCase()} saved
      </p>
      <p className={`mt-1.5 max-w-64 text-xs leading-5 ${TEXT_SUBTLE}`}>
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
    marketplaceItems,
    marketplaceWorkflows,
    marketplaceRefreshing,
    activeCategory,
    sidebarOpen,
    closeSidebar,
    remove,
    load,
    removeLibraryItem: removeLibItem,
    setActiveCategory,
    refreshMarketplaces,
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

  const handleLoadMarketplaceWorkflow = useCallback(
    (mpWf: MarketplaceWorkflowEntry) => {
      if (onLoadWorkflow) {
        onLoadWorkflow(mpWf.workflow, mpWf.id);
      } else {
        loadWorkflow(mpWf.workflow, { savedToLibrary: false });
      }
      useSavedWorkflowsStore.getState().clearActiveId();
      window.dispatchEvent(new CustomEvent("nexus:fit-view"));
      toast.success("Marketplace workflow loaded");
    },
    [loadWorkflow, onLoadWorkflow],
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

  const filteredMarketplaceWorkflows = useMemo(() => {
    if (activeCategory !== "all" && activeCategory !== "workflow") return [];
    return marketplaceWorkflows.filter((e) =>
      !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [marketplaceWorkflows, activeCategory, searchQuery]);

  const allItems = useMemo(
    () => [...libraryItems, ...(marketplaceItems as unknown as LibraryItemEntry[])],
    [libraryItems, marketplaceItems],
  );

  const filteredItems = useMemo(() => {
    let items = allItems;
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
  }, [allItems, activeCategory, searchQuery]);

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: entries.length + allItems.length + marketplaceWorkflows.length,
      workflow: entries.length + marketplaceWorkflows.length,
    };
    for (const item of allItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [entries, allItems, marketplaceWorkflows]);

  const hasItems = filteredWorkflows.length > 0 || filteredMarketplaceWorkflows.length > 0 || filteredItems.length > 0;
  const activeCategoryLabel = LIBRARY_CATEGORIES.find((category) => category.value === activeCategory)?.label ?? "All";
  return (
    <>
      <div
        className={`${PANEL_SHELL_CLASS} ${
          sidebarOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
        style={{
          width: "min(420px, calc(100vw - 32px))",
          height: "calc(100vh - 112px)",
          maxHeight: "calc(100vh - 112px)",
        }}
      >
        {/* ── Header ── */}
        <div className="shrink-0 border-b border-zinc-800/80 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-linear-to-br from-blue-500/15 to-violet-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <Folders className="h-4 w-4 text-blue-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-100">Library</span>
                <Badge
                  variant="outline"
                  className="rounded-full border-zinc-700/70 bg-zinc-950/70 px-2 py-0 text-[10px] font-medium text-zinc-400"
                >
                  {categoryCounts.all} total
                </Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Browse saved workflows and reusable components</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refreshMarketplaces()}
                disabled={marketplaceRefreshing}
                className={`h-8 w-8 rounded-lg ${TEXT_MUTED} hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors`}
                title="Refresh marketplace items"
              >
                <RefreshCw size={14} className={marketplaceRefreshing ? "animate-spin" : ""} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeSidebar}
                className={`h-8 w-8 rounded-lg ${TEXT_MUTED} hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors`}
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-3 pb-3 pt-3">
          <div className={`${PANEL_SURFACE_CLASS} p-2.5`}>
            <div className="relative">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${TEXT_SUBTLE}`} />
              <input
                type="text"
                placeholder="Search workflows and library items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`h-10 w-full rounded-xl border border-zinc-700/50 bg-zinc-950/70 pl-9 pr-3 text-sm ${TEXT_SECONDARY} placeholder:text-zinc-500 outline-none transition-colors focus:border-zinc-600`}
              />
            </div>
          </div>
        </div>

        {/* ── Category tabs ── */}
        <div className="shrink-0 px-3 pb-3">
          <TooltipProvider delayDuration={150}>
            <div className={`${PANEL_SURFACE_CLASS} p-2`}>
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
                {LIBRARY_CATEGORIES.map(({ value, label }) => {
                  const isActive = activeCategory === value;
                  const count = categoryCounts[value] ?? 0;
                  const Icon = CATEGORY_ICONS[value] ?? LayoutGrid;
                  const hex = CATEGORY_ACCENT_HEX[value] ?? null;

                  return (
                    <Tooltip key={value}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setActiveCategory(value)}
                          className={`relative flex h-10 w-full items-center justify-center rounded-xl border transition-all duration-200 ease-out ${
                            isActive
                              ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                              : `border-transparent ${TEXT_SUBTLE} hover:border-zinc-700/70 hover:bg-zinc-800/70 hover:text-zinc-300`
                          }`}
                          style={isActive ? {
                            backgroundColor: hex ? `${hex}14` : "rgba(63,63,70,0.7)",
                            color: hex ?? "#e4e4e7",
                            borderColor: hex ? `${hex}30` : "rgba(82,82,91,0.8)",
                          } : undefined}
                          aria-label={label}
                          title={label}
                        >
                          <Icon size={15} className="shrink-0" />
                          {count > 0 && (
                            <span className="absolute -right-1 -top-1 rounded-full border border-zinc-800 bg-zinc-900 px-1 text-[9px] font-semibold leading-4 text-zinc-300">
                              {count}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2">
                <div className="min-w-0 truncate text-xs font-medium text-zinc-200">{activeCategoryLabel}</div>
                <div className="shrink-0 text-[10px] text-zinc-500">{categoryCounts[activeCategory] ?? 0} item{(categoryCounts[activeCategory] ?? 0) !== 1 ? "s" : ""}</div>
              </div>
            </div>
          </TooltipProvider>
        </div>

        <div className="mx-3 border-t border-zinc-800/70" />

        {/* ── Content ── */}
        <div className="flex min-h-0 flex-1">
          <ScrollArea className="flex-1 min-h-0 w-full" viewportClassName="overscroll-contain">
            <div className="space-y-3 p-3.5">
            {!hasItems && <EmptyState category={activeCategory} />}

            {/* Workflows section */}
            {(filteredWorkflows.length > 0 || filteredMarketplaceWorkflows.length > 0) && (
              <>
                {activeCategory === "all" && (
                  <SectionHeader icon={Layers} label="Workflows" count={filteredWorkflows.length + filteredMarketplaceWorkflows.length} accentClass="text-blue-300" />
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
                {filteredMarketplaceWorkflows.map((mpWf) => (
                  <WorkflowCard
                    key={mpWf.id}
                    entry={{
                      id: mpWf.id,
                      name: mpWf.name,
                      savedAt: mpWf.savedAt,
                      updatedAt: mpWf.updatedAt,
                      nodeCount: mpWf.nodeCount,
                      edgeCount: mpWf.edgeCount,
                      workflow: mpWf.workflow,
                    }}
                    onLoad={() => handleLoadMarketplaceWorkflow(mpWf)}
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    readonly
                    marketplaceInfo={{
                      marketplaceName: mpWf.marketplaceName,
                      pluginName: mpWf.pluginName,
                    }}
                  />
                ))}
              </>
            )}

            {/* Library items section */}
            {filteredItems.length > 0 && (
              <>
                {activeCategory === "all" && filteredWorkflows.length > 0 && (
                  <div className="mx-1 border-t border-zinc-800/70 pt-1" />
                )}
                {activeCategory === "all" && (
                  <SectionHeader icon={LayoutGrid} label="Components" count={filteredItems.length} accentClass="text-violet-300" />
                )}
                {filteredItems.map((item) => {
                  const mpItem = "readonly" in item && item.readonly ? (item as unknown as MarketplaceLibraryItem) : null;
                  return (
                    <LibraryItemCard
                      key={item.id}
                      item={item}
                      onLoad={handleLoadItem}
                      onDelete={handleDeleteItem}
                      readonly={!!mpItem}
                      marketplaceInfo={mpItem ? { marketplaceName: mpItem.marketplaceName, pluginName: mpItem.pluginName } : undefined}
                    />
                  );
                })}
              </>
            )}
            </div>
          </ScrollArea>
        </div>
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


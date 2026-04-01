import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
import {
  Check,
  FolderOpen,
  Package,
  Pencil,
  Save,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { useSavedWorkflowsStore } from "@/store/library";
import { LIBRARY_CATEGORIES, type SavedWorkflowEntry } from "@/lib/library";
import { TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_SUBTLE } from "@/lib/theme";
import {
  CARD_CLASS,
  CATEGORY_ICONS,
  EMPTY_STATE_FALLBACK_ICON,
  META_BADGE_CLASS,
  PANEL_SURFACE_CLASS,
  SECTION_HEADER_BADGE_CLASS,
  cardIconButtonClass,
  formatTimeAgo,
} from "./constants";
import type { LibraryPanelCategory, LibraryPanelItem } from "./types";
import { NodePreview, WorkflowMiniMap } from "./previews";

interface InlineRenameState {
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  setRenameValue: (value: string) => void;
  startRenaming: () => void;
  cancelRenaming: () => void;
  commitRename: () => void;
}

function useInlineRename(initialValue: string, onCommit: (nextValue: string) => void): InlineRenameState {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(initialValue);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const startRenaming = useCallback(() => {
    setRenameValue(initialValue);
    setIsRenaming(true);
  }, [initialValue]);

  const cancelRenaming = useCallback(() => {
    setIsRenaming(false);
  }, []);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== initialValue) {
      onCommit(trimmed);
    }
    setIsRenaming(false);
  }, [initialValue, onCommit, renameValue]);

  return {
    isRenaming,
    renameValue,
    renameInputRef,
    setRenameValue,
    startRenaming,
    cancelRenaming,
    commitRename,
  };
}

function InlineRenameField({
  value,
  inputRef,
  setValue,
  onCommit,
  onCancel,
}: {
  value: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setValue: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit();
          if (event.key === "Escape") onCancel();
        }}
        className={`h-8 w-full rounded-lg border border-blue-500/40 bg-zinc-950/70 px-2.5 text-sm font-medium ${TEXT_PRIMARY} outline-none transition-colors focus:border-blue-400`}
      />
      <button type="button" onClick={onCommit} className={`rounded-lg p-1.5 hover:bg-zinc-800 ${TEXT_MUTED}`}>
        <Check size={12} />
      </button>
    </div>
  );
}

export function CardIconButton({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: ElementType;
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

export function SectionHeader({
  icon: Icon,
  label,
  count,
  accentClass,
}: {
  icon: ElementType;
  label: string;
  count: number;
  accentClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border border-current/10 bg-current/10 ${accentClass}`}>
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">{label}</div>
        </div>
      </div>
      <Badge variant="outline" className={SECTION_HEADER_BADGE_CLASS}>
        {count}
      </Badge>
    </div>
  );
}

function MarketplaceSourceBadge({
  pluginName,
  marketplaceName,
}: {
  pluginName: string;
  marketplaceName: string;
}) {
  const isNexusPlugin = pluginName === "_nexus";

  return (
    <>
      <span
        className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300"
        title={`Marketplace: ${marketplaceName}`}
      >
        <Store size={9} />
        {marketplaceName}
      </span>
      {!isNexusPlugin && (
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

export function WorkflowCard({
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
  const rename = useSavedWorkflowsStore((state) => state.rename);
  const {
    isRenaming,
    renameValue,
    renameInputRef,
    setRenameValue,
    startRenaming,
    cancelRenaming,
    commitRename,
  } = useInlineRename(entry.name, (nextValue) => {
    rename(entry.id, nextValue);
    toast.success("Workflow renamed");
  });

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
              <InlineRenameField
                value={renameValue}
                inputRef={renameInputRef}
                setValue={setRenameValue}
                onCommit={commitRename}
                onCancel={cancelRenaming}
              />
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
                <MarketplaceSourceBadge
                  pluginName={marketplaceInfo.pluginName}
                  marketplaceName={marketplaceInfo.marketplaceName}
                />
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

export function LibraryItemCard({
  item,
  onLoad,
  onDelete,
  readonly = false,
  marketplaceInfo,
}: {
  item: LibraryPanelItem;
  onLoad: (item: LibraryPanelItem) => void;
  onDelete: (id: string) => void;
  readonly?: boolean;
  marketplaceInfo?: { marketplaceName: string; pluginName: string };
}) {
  const renameLibraryItem = useSavedWorkflowsStore((state) => state.renameLibraryItem);
  const registryEntry = NODE_REGISTRY[item.nodeType];
  const accentHex = registryEntry?.accentHex ?? "#52525b";
  const {
    isRenaming,
    renameValue,
    renameInputRef,
    setRenameValue,
    startRenaming,
    cancelRenaming,
    commitRename,
  } = useInlineRename(item.name, (nextValue) => {
    renameLibraryItem(item.id, nextValue);
    toast.success("Item renamed");
  });

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
              <InlineRenameField
                value={renameValue}
                inputRef={renameInputRef}
                setValue={setRenameValue}
                onCommit={commitRename}
                onCancel={cancelRenaming}
              />
            ) : (
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className={`min-w-0 max-w-full truncate text-left text-sm font-semibold ${TEXT_SECONDARY} transition-colors hover:text-zinc-100`}
                  onDoubleClick={readonly ? undefined : startRenaming}
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
              <span className={META_BADGE_CLASS}>Updated {timeAgo}</span>
              {marketplaceInfo && (
                <MarketplaceSourceBadge
                  pluginName={marketplaceInfo.pluginName}
                  marketplaceName={marketplaceInfo.marketplaceName}
                />
              )}
            </div>
          </div>

          {!readonly && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <CardIconButton icon={Pencil} label="Rename item" onClick={startRenaming} />
              <CardIconButton icon={Trash2} label="Delete item" onClick={() => onDelete(item.id)} tone="danger" />
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLoad(item)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-500/20 hover:text-blue-100"
            title="Add to canvas"
          >
            <FolderOpen size={12} />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ category }: { category: LibraryPanelCategory }) {
  const Icon = CATEGORY_ICONS[category] ?? EMPTY_STATE_FALLBACK_ICON;
  const label = LIBRARY_CATEGORIES.find((entry) => entry.value === category)?.label ?? "items";

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
          : 'Right-click a node on the canvas and select "Save to Library"'}
      </p>
    </div>
  );
}


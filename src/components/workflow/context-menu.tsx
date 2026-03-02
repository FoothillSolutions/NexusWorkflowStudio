"use client";

import { useEffect, useRef } from "react";
import { Copy, Trash2, BookmarkPlus, GitBranch } from "lucide-react";
import type { NodeType } from "@/types/workflow";

export type ContextMenuTarget =
  | { kind: "node"; nodeId: string; nodeType: NodeType; isDeletable: boolean; isDuplicatable: boolean }
  | { kind: "selection" }
  | { kind: "pane" };

/** Node types that can be saved to the library */
const SAVEABLE_TYPES = new Set<NodeType>(["agent", "skill", "document", "mcp-tool", "prompt"]);

interface ContextMenuProps {
  x: number;
  y: number;
  target: ContextMenuTarget;
  selectedCount: number;
  onClose: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onDeleteSelected?: () => void;
  onDuplicateSelected?: () => void;
  onSaveToLibrary?: () => void;
  onGroupIntoSubWorkflow?: () => void;
}

export function ContextMenu({
  x,
  y,
  target,
  selectedCount,
  onClose,
  onDelete,
  onDuplicate,
  onDeleteSelected,
  onDuplicateSelected,
  onSaveToLibrary,
  onGroupIntoSubWorkflow,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // capture:true fires before ReactFlow can stopPropagation on the pane
    window.addEventListener("mousedown", handleClick, true);
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("mousedown", handleClick, true);
      window.removeEventListener("keydown", handleKey, true);
    };
  }, [onClose]);

  const style: React.CSSProperties = { position: "fixed", left: x, top: y, zIndex: 1000 };

  // ── What actions are available ──────────────────────────────────────────
  const isNode = target.kind === "node";
  const isSelection = target.kind === "selection";
  const multiSelected = selectedCount > 1;

  // Single node actions
  const nodeTarget = isNode ? (target as Extract<ContextMenuTarget, { kind: "node" }>) : null;
  const canDuplicate = isNode && nodeTarget!.isDuplicatable && !!onDuplicate;
  const canDelete    = isNode && nodeTarget!.isDeletable  && !!onDelete;
  const canSaveToLib = isNode && SAVEABLE_TYPES.has(nodeTarget!.nodeType) && !!onSaveToLibrary;

  // Multi-select / selection actions (shown when selection box right-clicked OR on a node that's part of a multi-select)
  const showSelectionActions = (isSelection || (isNode && multiSelected)) && selectedCount > 1;
  const canDuplicateSelected = showSelectionActions && !!onDuplicateSelected;
  const canDeleteSelected    = showSelectionActions && !!onDeleteSelected;
  const canGroupIntoSubWorkflow = showSelectionActions && !!onGroupIntoSubWorkflow;

  const hasSingle    = canDuplicate || canDelete || canSaveToLib;
  const hasMulti     = canDuplicateSelected || canDeleteSelected || canGroupIntoSubWorkflow;

  if (!hasSingle && !hasMulti) return null;

  return (
    <div
      ref={ref}
      style={style}
      className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/60 rounded-xl shadow-2xl shadow-black/70 p-1 min-w-[160px] text-[13px]"
    >
      {/* ── Single node actions ── */}
      {canSaveToLib && (
        <button
          onClick={() => { onSaveToLibrary!(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors duration-100"
        >
          <BookmarkPlus size={13} className="shrink-0" />
          Save to Library
        </button>
      )}
      {canSaveToLib && (canDuplicate || canDelete) && <div className="border-t border-zinc-700/50 my-1 mx-1" />}
      {canDuplicate && (
        <button
          onClick={() => { onDuplicate!(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-zinc-300 hover:bg-zinc-700/70 hover:text-white transition-colors duration-100"
        >
          <Copy size={13} className="text-zinc-500 shrink-0" />
          Duplicate
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => { onDelete!(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors duration-100"
        >
          <Trash2 size={13} className="shrink-0" />
          Delete Node
        </button>
      )}

      {/* ── Divider between single and multi actions ── */}
      {hasSingle && hasMulti && <div className="border-t border-zinc-700/50 my-1 mx-1" />}

      {/* ── Multi-select actions ── */}
      {canGroupIntoSubWorkflow && (
        <button
          onClick={() => { onGroupIntoSubWorkflow!(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 transition-colors duration-100"
        >
          <GitBranch size={13} className="shrink-0" />
          Add to Sub-Workflow ({selectedCount})
        </button>
      )}
      {canDuplicateSelected && (
        <button
          onClick={() => { onDuplicateSelected!(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-zinc-300 hover:bg-zinc-700/70 hover:text-white transition-colors duration-100"
        >
          <Copy size={13} className="text-zinc-500 shrink-0" />
          Duplicate Selected ({selectedCount})
        </button>
      )}
      {canDeleteSelected && (
        <button
          onClick={() => { onDeleteSelected!(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors duration-100"
        >
          <Trash2 size={13} className="shrink-0" />
          Delete Selected ({selectedCount})
        </button>
      )}
    </div>
  );
}


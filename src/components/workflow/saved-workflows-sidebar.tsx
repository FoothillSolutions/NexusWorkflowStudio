"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useSavedWorkflowsStore } from "@/store/saved-workflows-store";
import { useWorkflowStore } from "@/store/workflow-store";
import type { SavedWorkflowEntry } from "@/lib/saved-workflows";
import type { NodeType } from "@/types/workflow";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  X,
  Save,
  Trash2,
  FolderOpen,
  Clock,
  FileText,
  Check,
} from "lucide-react";
import {
  BG_SURFACE,
  BORDER_DEFAULT,
  BORDER_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_SUBTLE,
  BG_CANVAS_HEX,
} from "@/lib/theme";

// ── Mini-map renderer ───────────────────────────────────────────────────────
function WorkflowMiniMap({ entry }: { entry: SavedWorkflowEntry }) {
  const nodes = entry.workflow.nodes;
  const edges = entry.workflow.edges;

  if (nodes.length === 0) {
    return (
      <div className="w-full h-24 rounded-lg bg-zinc-950 flex items-center justify-center">
        <span className={`text-xs ${TEXT_SUBTLE}`}>Empty workflow</span>
      </div>
    );
  }

  // Compute bounding box
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
  const svgH = 96;
  const padding = 16;

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

  // Build edge lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      width="100%"
      height="96"
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="rounded-lg"
      style={{ backgroundColor: BG_CANVAS_HEX }}
    >
      {/* Edges */}
      {edges.map((edge) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return null;
        const x1 = toX(src.position.x) + nodeW / 2;
        const y1 = toY(src.position.y) + nodeH / 2;
        const x2 = toX(tgt.position.x) + nodeW / 2;
        const y2 = toY(tgt.position.y) + nodeH / 2;
        return (
          <line
            key={edge.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#444"
            strokeWidth={1.5}
            opacity={0.6}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const nodeType = (node.data?.type ?? node.type) as NodeType;
        const color = NODE_REGISTRY[nodeType]?.accentHex ?? "#52525b";
        const x = toX(node.position.x);
        const y = toY(node.position.y);
        return (
          <rect
            key={node.id}
            x={x}
            y={y}
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
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [entry.updatedAt]);

  return (
    <div className={`group rounded-xl border ${BORDER_MUTED} bg-zinc-800/40 hover:bg-zinc-800/70 hover:border-zinc-600 transition-all duration-200 overflow-hidden`}>
      {/* Mini-map preview with action buttons overlay */}
      <div className="relative">
        <div className="cursor-pointer" onClick={() => onLoad(entry.id)}>
          <WorkflowMiniMap entry={entry} />
        </div>

        {/* Action buttons — top-left overlay, visible on hover */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => onLoad(entry.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-600/90 hover:bg-blue-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Load this workflow"
          >
            <FolderOpen size={11} /> Load
          </button>
          <button
            onClick={() => onUpdate(entry.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-600/90 hover:bg-emerald-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Overwrite with current workflow"
          >
            <Save size={11} /> Update
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-red-600/90 hover:bg-red-500 text-white backdrop-blur-sm shadow-md transition-colors"
            title="Delete this workflow"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>

      {/* Info area */}
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
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
                  className={`text-sm font-medium ${TEXT_PRIMARY} bg-transparent border-b border-blue-500 outline-none w-full px-0.5`}
                />
                <button
                  onClick={handleRename}
                  className={`p-0.5 rounded hover:bg-zinc-700 ${TEXT_MUTED}`}
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <div
                className={`text-sm font-medium ${TEXT_SECONDARY} truncate cursor-pointer hover:text-zinc-100 transition-colors`}
                onDoubleClick={() => { setIsRenaming(true); setRenameValue(entry.name); }}
                title="Double-click to rename"
              >
                {entry.name}
              </div>
            )}
            <div className={`flex items-center gap-2 mt-1 text-xs ${TEXT_SUBTLE}`}>
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {timeAgo}
              </span>
              <span>·</span>
              <span>{entry.nodeCount} nodes</span>
              <span>·</span>
              <span>{entry.edgeCount} edges</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main sidebar component ──────────────────────────────────────────────────
export default function SavedWorkflowsSidebar() {
  const {
    entries,
    sidebarOpen,
    closeSidebar,
    save,
    remove,
    load,
  } = useSavedWorkflowsStore();

  const { getWorkflowJSON, loadWorkflow } = useWorkflowStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSaveCurrent = useCallback(() => {
    const json = getWorkflowJSON();
    save(json);
    toast.success("Workflow saved to library");
  }, [getWorkflowJSON, save]);

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

  const handleDelete = useCallback(
    (id: string) => {
      setConfirmDeleteId(id);
    },
    []
  );

  const confirmDelete = useCallback(() => {
    if (confirmDeleteId) {
      remove(confirmDeleteId);
      setConfirmDeleteId(null);
      toast.success("Workflow deleted");
    }
  }, [confirmDeleteId, remove]);

  const handleUpdate = useCallback(
    (id: string) => {
      const json = getWorkflowJSON();
      save(json, id);
      toast.success("Workflow updated");
    },
    [getWorkflowJSON, save]
  );

  return (
    <>
      {/* Sidebar panel */}
      <div
        className={`fixed top-0 right-0 h-full z-40 flex flex-col ${BG_SURFACE} border-l ${BORDER_DEFAULT} shadow-2xl transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? "w-[320px] opacity-100 translate-x-0"
            : "w-0 opacity-0 translate-x-full pointer-events-none"
        }`}
      >
        {/* ...existing code... */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${BORDER_DEFAULT} shrink-0`}>
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            <span className={`text-sm font-semibold ${TEXT_SECONDARY}`}>
              Saved Workflows
            </span>
            {entries.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full bg-zinc-800 ${TEXT_SUBTLE}`}>
                {entries.length}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSidebar}
            className={`h-7 w-7 ${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800`}
          >
            <X size={16} />
          </Button>
        </div>

        {/* Save current button */}
        <div className="px-3 py-3 shrink-0">
          <Button
            onClick={handleSaveCurrent}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm h-9 rounded-lg"
          >
            <Save size={14} className="mr-2" />
            Save Current Workflow
          </Button>
        </div>

        {/* Workflow list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 pb-3 space-y-3">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText size={40} className={`${TEXT_SUBTLE} mb-3`} />
                <p className={`text-sm font-medium ${TEXT_MUTED}`}>
                  No saved workflows
                </p>
                <p className={`text-xs ${TEXT_SUBTLE} mt-1`}>
                  Save your current workflow to see it here
                </p>
              </div>
            ) : (
              entries.map((entry) => (
                <WorkflowCard
                  key={entry.id}
                  entry={entry}
                  onLoad={handleLoad}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Backdrop overlay when open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Delete confirmation overlay */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDeleteId(null)}>
          <div
            className={`rounded-2xl border ${BORDER_MUTED} ${BG_SURFACE} shadow-2xl p-6 w-80 animate-in fade-in-0 zoom-in-95`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <h3 className={`text-sm font-semibold ${TEXT_PRIMARY}`}>
                Delete Workflow?
              </h3>
            </div>
            <p className={`text-xs ${TEXT_MUTED} mb-1`}>
              You are about to delete:
            </p>
            <p className={`text-sm font-medium ${TEXT_PRIMARY} mb-4 truncate`}>
              &ldquo;{entries.find((e) => e.id === confirmDeleteId)?.name ?? "Unknown"}&rdquo;
            </p>
            <p className={`text-xs ${TEXT_SUBTLE} mb-4`}>
              This action cannot be undone. The saved workflow will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteId(null)}
                className={`${TEXT_MUTED} hover:text-zinc-100`}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                <Trash2 size={12} className="mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


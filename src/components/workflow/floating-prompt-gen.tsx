"use client";

import { useCallback } from "react";
import {
  Sparkles, PenLine, X, ChevronDown, ChevronUp, PanelBottomClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/store/workflow-store";
import { usePromptGenStore } from "@/store/prompt-gen-store";
import { PromptGenBody } from "@/nodes/sub-agent/prompt-gen-body";

// ── Component ────────────────────────────────────────────────────────────────
// Renders as a floating panel only when the user has explicitly undocked.
// Provides collapse (minimize body) and dock-back controls.

export default function FloatingPromptGen() {
  const view = usePromptGenStore((s) => s.view);
  const floating = usePromptGenStore((s) => s.floating);
  const collapsed = usePromptGenStore((s) => s.collapsed);
  const targetNodeId = usePromptGenStore((s) => s.targetNodeId);
  const status = usePromptGenStore((s) => s.status);

  const storeClose = usePromptGenStore((s) => s.close);
  const dock = usePromptGenStore((s) => s.dock);
  const toggleCollapsed = usePromptGenStore((s) => s.toggleCollapsed);

  const isGenerating = status === "generating" || status === "streaming" || status === "creating-session";
  const isEditMode = view === "edit";

  // Find target node label for the header
  const targetNodeLabel = useWorkflowStore(
    useCallback(
      (s) => {
        if (!targetNodeId) return null;
        const node = s.nodes.find((n) => n.id === targetNodeId) ?? s.subWorkflowNodes.find((n) => n.id === targetNodeId);
        return node?.data?.label ?? node?.data?.name ?? targetNodeId;
      },
      [targetNodeId],
    ),
  );

  // Only render when floating and open
  if (view === "closed" || !floating) return null;

  return (
    <div
      className={cn(
        "absolute z-40 flex flex-col rounded-2xl border bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden",
        "animate-in slide-in-from-bottom-4 fade-in-0 duration-200",
        isEditMode ? "border-amber-700/30" : "border-violet-700/30",
      )}
      style={{ bottom: 16, left: 16, width: 380, maxHeight: collapsed ? undefined : "calc(100vh - 140px)" }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center justify-between px-3.5 py-2.5 border-b shrink-0",
        isEditMode ? "bg-amber-950/20 border-amber-800/20" : "bg-violet-950/30 border-violet-800/20",
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {isEditMode
            ? <PenLine size={14} className="text-amber-400 shrink-0" />
            : <Sparkles size={14} className="text-violet-400 shrink-0" />}
          <div className="min-w-0">
            <span className="text-xs font-semibold text-zinc-200 block">
              {isEditMode ? "Edit Prompt with AI" : "Generate Prompt with AI"}
            </span>
            {targetNodeLabel && (
              <span className="text-[10px] text-zinc-500 truncate block">
                → {targetNodeLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Collapse / expand toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand" : "Collapse"}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {/* Dock back into properties panel */}
          <button
            type="button"
            onClick={dock}
            title="Dock back to properties panel"
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <PanelBottomClose size={13} />
          </button>
          {/* Close */}
          <button
            type="button"
            onClick={storeClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Collapsed status bar ──────────────────────────────────── */}
      {collapsed && (
        <div className="px-3.5 py-2 flex items-center gap-2 text-[11px] text-zinc-400">
          {isGenerating ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Generating…
            </>
          ) : status === "done" ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Ready to apply
            </>
          ) : (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-600" />
              {isEditMode ? "Edit mode" : "Generate mode"}
            </>
          )}
        </div>
      )}

      {/* ── Scrollable body (hidden when collapsed) ──────────────── */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-3.5">
          <PromptGenBody />
        </div>
      )}
    </div>
  );
}


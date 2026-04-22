"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, X, GitCompareArrows, HelpCircle, Columns2, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { applyDecisions, computeHunks } from "@/lib/diff/compute";
import { alignRows } from "@/lib/diff/align";
import type { HunkDecision } from "@/lib/diff/types";
import { usePromptGenStore } from "@/store/prompt-gen";
import { useWorkflowStore } from "@/store/workflow";
import { WorkflowNodeType } from "@/types/workflow";
import { getScriptEditorLanguage } from "@/nodes/skill/script-utils";
import { HunkList } from "./hunk-list";
import { MergedPreview } from "./merged-preview";
import { SideBySideView } from "./side-by-side-view";
import { useDiffKeyboard } from "./use-diff-keyboard";

// ── View mode ──────────────────────────────────────────────────────────────
// Side-by-side is the default for new sessions; the last choice is persisted
// to localStorage under `nexus-diff-view-mode`. Rendering is SSR-safe: the
// first render uses the default, then the effect re-hydrates from storage.

type DiffViewMode = "sidebyside" | "unified";
const VIEW_MODE_KEY = "nexus-diff-view-mode";
const LARGE_DIFF_THRESHOLD = 2000;

function isViewMode(v: unknown): v is DiffViewMode {
  return v === "sidebyside" || v === "unified";
}

// ── Labels per targetField for the panel title ──────────────────────────────

function humanFieldLabel(field: string): string {
  switch (field) {
    case "promptText": return "Prompt";
    case "sharedInstructions": return "Shared Instructions";
    case "contentText": return "Document";
    default: return field;
  }
}

function humanNodeLabel(nodeType: WorkflowNodeType | null | undefined): string {
  switch (nodeType) {
    case WorkflowNodeType.Agent: return "Agent";
    case WorkflowNodeType.Skill: return "Skill";
    case WorkflowNodeType.Script: return "Script";
    case WorkflowNodeType.Prompt: return "Prompt";
    case WorkflowNodeType.ParallelAgent: return "Parallel Agent";
    case WorkflowNodeType.Document: return "Document";
    default: return "Node";
  }
}

// ─── DiffReviewDialog ───────────────────────────────────────────────────────
// In-editor overlay (JetBrains-style merge view) rather than a shadcn Dialog.
// Sits over the workflow canvas, fills most of the viewport, and uses a
// two-column layout: hunk list on the left, live merged-result preview on the
// right. Keeps the exported component name / file name to avoid churn in
// callers and the mount site (`src/components/workflow/workflow-editor.tsx`).

export function DiffReviewDialog() {
  const open = usePromptGenStore((s) => s.diffReviewOpen);
  const targetPrompt = usePromptGenStore((s) => s.targetPrompt);
  const generatedText = usePromptGenStore((s) => s.generatedText);
  const targetNodeId = usePromptGenStore((s) => s.targetNodeId);
  const targetNodeType = usePromptGenStore((s) => s.targetNodeType);
  const targetField = usePromptGenStore((s) => s.targetField);
  const closeDiffReview = usePromptGenStore((s) => s.closeDiffReview);
  const applyMergedResult = usePromptGenStore((s) => s.applyMergedResult);

  const targetNodeLabel = useWorkflowStore((s) => {
    if (!targetNodeId) return null;
    const node = s.nodes.find((n) => n.id === targetNodeId)
      ?? s.subWorkflowNodes.find((n) => n.id === targetNodeId);
    return (node?.data as { label?: string; name?: string } | undefined)?.label
      ?? (node?.data as { label?: string; name?: string } | undefined)?.name
      ?? targetNodeId;
  });

  const isScriptNode = targetNodeType === WorkflowNodeType.Script;
  const scriptLanguage = useMemo(() => {
    if (!isScriptNode || !targetNodeId) return "typescript";
    const state = useWorkflowStore.getState();
    const node = state.nodes.find((n) => n.id === targetNodeId)
      ?? state.subWorkflowNodes.find((n) => n.id === targetNodeId);
    return getScriptEditorLanguage(node?.data as { label?: string; name?: string } | undefined);
  }, [isScriptNode, targetNodeId]);

  const hunks = useMemo(
    () => (open ? computeHunks(targetPrompt, generatedText) : []),
    [open, targetPrompt, generatedText],
  );

  const [decisions, setDecisions] = useState<Map<string, HunkDecision>>(new Map());
  const [lineDecisions, setLineDecisions] = useState<Map<string, Map<number, boolean>>>(new Map());
  const [selectedHunkId, setSelectedHunkId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<DiffViewMode>("sidebyside");

  // Hydrate last-used view mode from localStorage on first mount (client only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(VIEW_MODE_KEY);
      if (isViewMode(raw)) setViewMode(raw);
    } catch {
      // localStorage may throw in sandboxed contexts — fall back to default.
    }
  }, []);

  const changeViewMode = useCallback((next: DiffViewMode) => {
    setViewMode(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // Large-diff fallback: force unified view and show a warning chip when the
  // aligned row count would exceed the threshold (we bypass virtualization).
  const alignedRowCount = useMemo(
    () => (open && viewMode === "sidebyside" ? alignRows(targetPrompt, generatedText, hunks).length : 0),
    [open, viewMode, targetPrompt, generatedText, hunks],
  );
  const isLargeDiff = alignedRowCount > LARGE_DIFF_THRESHOLD;
  const effectiveViewMode: DiffViewMode = isLargeDiff ? "unified" : viewMode;

  // Reset per-session state whenever the panel opens or the hunks change.
  useEffect(() => {
    if (!open) return;
    setDecisions(new Map());
    setLineDecisions(new Map());
    setSelectedHunkId(hunks[0]?.id ?? null);
  }, [open, hunks]);

  const setDecision = useCallback((id: string, next: HunkDecision) => {
    setDecisions((prev) => {
      const out = new Map(prev);
      out.set(id, next);
      return out;
    });
  }, []);

  const acceptAll = useCallback(() => {
    setDecisions(() => {
      const out = new Map<string, HunkDecision>();
      hunks.forEach((h) => out.set(h.id, "accepted"));
      return out;
    });
  }, [hunks]);

  const rejectAll = useCallback(() => {
    setDecisions(() => {
      const out = new Map<string, HunkDecision>();
      hunks.forEach((h) => out.set(h.id, "rejected"));
      return out;
    });
  }, [hunks]);

  const toggleLine = useCallback((hunkId: string, lineIndex: number, accepted: boolean) => {
    setLineDecisions((prev) => {
      const out = new Map(prev);
      const inner = new Map(out.get(hunkId) ?? new Map());
      inner.set(lineIndex, accepted);
      out.set(hunkId, inner);
      return out;
    });
  }, []);

  const resetLines = useCallback((hunkId: string) => {
    setLineDecisions((prev) => {
      if (!prev.has(hunkId)) return prev;
      const out = new Map(prev);
      out.delete(hunkId);
      return out;
    });
  }, []);

  const toggleSelected = useCallback(() => {
    if (!selectedHunkId) return;
    const current = decisions.get(selectedHunkId) ?? "pending";
    const next: HunkDecision = current === "pending"
      ? "accepted"
      : current === "accepted"
        ? "rejected"
        : "pending";
    setDecision(selectedHunkId, next);
  }, [decisions, selectedHunkId, setDecision]);

  const moveSelection = useCallback((delta: 1 | -1) => {
    if (hunks.length === 0) return;
    const idx = Math.max(0, hunks.findIndex((h) => h.id === selectedHunkId));
    const nextIdx = (idx + delta + hunks.length) % hunks.length;
    setSelectedHunkId(hunks[nextIdx].id);
  }, [hunks, selectedHunkId]);

  const merged = useMemo(() => applyDecisions({
    oldText: targetPrompt,
    newText: generatedText,
    hunks,
    hunkDecisions: decisions,
    lineDecisions,
  }), [targetPrompt, generatedText, hunks, decisions, lineDecisions]);

  const counts = useMemo(() => {
    let accepted = 0;
    let rejected = 0;
    let pending = 0;
    hunks.forEach((h) => {
      const d = decisions.get(h.id) ?? "pending";
      if (d === "accepted") accepted += 1;
      else if (d === "rejected") rejected += 1;
      else pending += 1;
    });
    return { accepted, rejected, pending };
  }, [hunks, decisions]);

  const handleConfirm = useCallback(() => {
    applyMergedResult(merged);
  }, [applyMergedResult, merged]);

  const panelRef = useRef<HTMLDivElement>(null);

  useDiffKeyboard(panelRef, open, {
    onNext: () => moveSelection(1),
    onPrev: () => moveSelection(-1),
    onAccept: () => selectedHunkId && setDecision(selectedHunkId, "accepted"),
    onReject: () => selectedHunkId && setDecision(selectedHunkId, "rejected"),
    onToggle: toggleSelected,
    onAcceptAll: acceptAll,
    onRejectAll: rejectAll,
    onExpand: () => { /* reserved — handled by inner hunk state */ },
    onConfirm: handleConfirm,
    onCancel: closeDiffReview,
  });

  // Lock body scroll while the panel is open; restore on close/unmount.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus the panel on open so keyboard shortcuts work immediately, and
  // scroll the first hunk into view.
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    // defer to next frame so refs inside HunkList are attached
    const raf = requestAnimationFrame(() => {
      el.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Window-level Esc fallback. If focus escapes the panel, pressing Esc still
  // closes the overlay (mirrors shadcn Dialog's default behavior now that we
  // no longer wrap in one).
  useEffect(() => {
    if (!open) return;
    const onWindowKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const panel = panelRef.current;
      // Only handle if the panel's scoped listener didn't already — i.e.
      // focus is outside the panel.
      if (panel && panel.contains(e.target as Node)) return;
      e.preventDefault();
      closeDiffReview();
    };
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, [open, closeDiffReview]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150"
        onClick={closeDiffReview}
        aria-hidden
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Review AI changes"
        tabIndex={-1}
        className={cn(
          "fixed inset-4 z-50 flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 text-zinc-200 shadow-2xl shadow-black/60 backdrop-blur-xl outline-none",
          "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
        )}
      >
        {/* ── Header ───────────────────────────────────────────────
            Layout per feedback #4:
              left  : title
              center: status counters
              right : [Accept all] [Reject all] | [?] [X]
        */}
        <div className="flex shrink-0 items-center gap-4 border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3">
          {/* Title (left) */}
          <div className="flex min-w-0 items-center gap-2">
            <GitCompareArrows size={14} className="shrink-0 text-violet-400" />
            <span className="text-sm font-semibold text-zinc-100">Review AI changes</span>
            <span className="mx-1 text-zinc-600">—</span>
            <span className="min-w-0 truncate text-sm text-zinc-400">
              {humanNodeLabel(targetNodeType)}
              {targetNodeLabel ? <span className="text-zinc-600"> · </span> : null}
              {targetNodeLabel && <span className="text-zinc-300">{targetNodeLabel}</span>}
              <span className="text-zinc-600"> → </span>
              <span className="text-violet-300">{humanFieldLabel(targetField)}</span>
            </span>
          </div>

          {/* Counters (center) */}
          <div className="flex flex-1 items-center justify-center">
            <span className="tabular-nums text-[11px] text-zinc-500">
              {hunks.length} {hunks.length === 1 ? "hunk" : "hunks"}
              {hunks.length > 0 && (
                <>
                  <span className="text-zinc-700"> · </span>
                  <span className="text-emerald-400">{counts.accepted} accepted</span>
                  <span className="text-zinc-700"> · </span>
                  <span className="text-red-400">{counts.rejected} rejected</span>
                  <span className="text-zinc-700"> · </span>
                  <span className="text-zinc-400">{counts.pending} pending</span>
                </>
              )}
            </span>
          </div>

          {/* Actions (right): [actions] | [view toggle] | [utilities] */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={acceptAll}
              disabled={hunks.length === 0}
              className="h-7 gap-1 rounded-lg px-2.5 text-[11px] text-emerald-300 hover:bg-emerald-950/30 hover:text-emerald-200"
            >
              <Check size={11} /> Accept all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={rejectAll}
              disabled={hunks.length === 0}
              className="h-7 gap-1 rounded-lg px-2.5 text-[11px] text-red-300 hover:bg-red-950/30 hover:text-red-200"
            >
              <X size={11} /> Reject all
            </Button>
            <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden />
            {/* View-mode toggle */}
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950/40 p-0.5">
              <button
                type="button"
                aria-label="Side-by-side view"
                aria-pressed={effectiveViewMode === "sidebyside"}
                onClick={() => changeViewMode("sidebyside")}
                disabled={isLargeDiff}
                title={isLargeDiff ? "Large diff — unified view" : "Side-by-side view"}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors",
                  effectiveViewMode === "sidebyside"
                    ? "bg-violet-600/20 text-violet-200"
                    : "text-zinc-500 hover:text-zinc-200",
                  isLargeDiff && "cursor-not-allowed opacity-50",
                )}
              >
                <Columns2 size={11} /> Side-by-side
              </button>
              <button
                type="button"
                aria-label="Unified view"
                aria-pressed={effectiveViewMode === "unified"}
                onClick={() => changeViewMode("unified")}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors",
                  effectiveViewMode === "unified"
                    ? "bg-violet-600/20 text-violet-200"
                    : "text-zinc-500 hover:text-zinc-200",
                )}
              >
                <Rows3 size={11} /> Unified
              </button>
            </div>
            {isLargeDiff && (
              <span className="rounded-md border border-amber-700/40 bg-amber-950/30 px-2 py-0.5 text-[10px] text-amber-300">
                Large diff — unified view
              </span>
            )}
            <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Keyboard shortcuts"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
                  >
                    <HelpCircle size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs">
                  <div className="space-y-1 text-[11px]">
                    <div><kbd>J</kbd>/<kbd>K</kbd> · next/prev hunk</div>
                    <div><kbd>Y</kbd>/<kbd>N</kbd> · accept/reject</div>
                    <div><kbd>U</kbd> · toggle selected</div>
                    <div><kbd>⇧A</kbd>/<kbd>⇧R</kbd> · accept/reject all</div>
                    <div><kbd>Space</kbd> · expand context</div>
                    <div><kbd>Enter</kbd> · confirm</div>
                    <div><kbd>Esc</kbd> · cancel</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              type="button"
              aria-label="Close"
              onClick={closeDiffReview}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Body (two columns) ───────────────────────────────────
            Left: unified hunk list or side-by-side view (scrollable).
            Right: merged-preview side panel.
            `min-h-0` on every flex ancestor so scroll containers can bound.
        */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {effectiveViewMode === "unified" ? (
              <div className="min-h-0 flex-1 overflow-hidden px-5 py-3">
                <HunkList
                  hunks={hunks}
                  decisions={decisions}
                  lineDecisions={lineDecisions}
                  selectedHunkId={selectedHunkId}
                  onSelect={setSelectedHunkId}
                  onAccept={(id) => setDecision(id, "accepted")}
                  onReject={(id) => setDecision(id, "rejected")}
                  onToggleLine={toggleLine}
                  onResetLines={resetLines}
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden">
                <SideBySideView
                  oldText={targetPrompt}
                  newText={generatedText}
                  hunks={hunks}
                  decisions={decisions}
                  lineDecisions={lineDecisions}
                  selectedHunkId={selectedHunkId}
                  onSelect={setSelectedHunkId}
                  onAccept={(id) => setDecision(id, "accepted")}
                  onReject={(id) => setDecision(id, "rejected")}
                  onToggleLine={toggleLine}
                  onResetLines={resetLines}
                />
              </div>
            )}
          </div>
          <MergedPreview
            merged={merged}
            isScript={isScriptNode}
            scriptLanguage={scriptLanguage}
            variant="side"
            open={sidePanelOpen}
            onOpenChange={setSidePanelOpen}
          />
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-800/60 bg-zinc-900/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={closeDiffReview}
            className="h-9 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="h-9 gap-2 rounded-lg bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-500"
          >
            <Check size={13} /> Confirm <span className="text-white/70">(⏎)</span>
          </Button>
        </div>
      </div>
    </>
  );
}

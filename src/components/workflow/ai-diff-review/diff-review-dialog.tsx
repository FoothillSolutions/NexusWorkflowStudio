"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, X, GitCompareArrows, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { applyDecisions, computeHunks } from "@/lib/diff/compute";
import type { HunkDecision } from "@/lib/diff/types";
import { usePromptGenStore } from "@/store/prompt-gen";
import { useWorkflowStore } from "@/store/workflow";
import { WorkflowNodeType } from "@/types/workflow";
import { getScriptEditorLanguage } from "@/nodes/skill/script-utils";
import { HunkList } from "./hunk-list";
import { MergedPreview } from "./merged-preview";
import { useDiffKeyboard } from "./use-diff-keyboard";

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

          {/* Actions (right) */}
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
            Left: hunk list (scrollable). Right: merged-preview side panel.
            `min-h-0` on every flex ancestor so the ScrollArea can actually
            bound itself (feedback #1).
        */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Hunk, HunkDecision, HunkLine } from "@/lib/diff/types";
import { alignRows, type AlignedRow } from "@/lib/diff/align";

// ─── Side-by-side Diff View ────────────────────────────────────────────────
// Single scrollable container with a 3-column grid (old | gutter | new). Each
// aligned row renders as one grid row with `items-stretch`, so when wrapping
// makes one side taller, both sides and the gutter stretch to the same height
// and line numbers stay aligned — JetBrains/VS Code style.
//
// Render performance note: we intentionally do not virtualize. For typical
// prompt sizes (< 500 lines) plain rendering is sub-ms. The caller falls
// back to unified view when the row count is > 2000 (see `diff-review-dialog.tsx`).

interface SideBySideViewProps {
  oldText: string;
  newText: string;
  hunks: Hunk[];
  decisions: Map<string, HunkDecision>;
  lineDecisions: Map<string, Map<number, boolean>>;
  selectedHunkId: string | null;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onToggleLine: (hunkId: string, lineIndex: number, accepted: boolean) => void;
  onResetLines: (hunkId: string) => void;
}

export function SideBySideView({
  oldText,
  newText,
  hunks,
  decisions,
  lineDecisions,
  selectedHunkId,
  onSelect,
  onAccept,
  onReject,
  onToggleLine,
  onResetLines,
}: SideBySideViewProps) {
  const rows = useMemo(() => alignRows(oldText, newText, hunks), [oldText, newText, hunks]);

  // Build a lookup of `hunkId` → row index range [first, last] so we know
  // where to place the hunk-level accept/reject buttons.
  const hunkRowRanges = useMemo(() => {
    const map = new Map<string, { first: number; last: number; hasModified: boolean }>();
    rows.forEach((row, idx) => {
      if (!row.hunkId) return;
      const existing = map.get(row.hunkId);
      const isModified = row.kind === "modified";
      if (existing) {
        existing.last = idx;
        if (isModified) existing.hasModified = true;
      } else {
        map.set(row.hunkId, { first: idx, last: idx, hasModified: isModified });
      }
    });
    return map;
  }, [rows]);

  // Map `hunk.id` → its indices into `hunk.lines`, so hover line-level
  // controls can write per-line overrides against the same index space
  // that `applyDecisions` reads.
  const hunkLineIndex = useMemo(() => {
    const map = new Map<string, Map<HunkLine, number>>();
    for (const hunk of hunks) {
      const inner = new Map<HunkLine, number>();
      hunk.lines.forEach((line, idx) => inner.set(line, idx));
      map.set(hunk.id, inner);
    }
    return map;
  }, [hunks]);

  const splittableHunkIds = useMemo(() => {
    const set = new Set<string>();
    for (const h of hunks) if (h.splittable) set.add(h.id);
    return set;
  }, [hunks]);

  // Single scroll container — row heights auto-align across old/gutter/new
  // because every triplet of cells shares a single grid row.
  const scrollRef = useRef<HTMLDivElement>(null);

  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const handleRowClick = useCallback((row: AlignedRow) => {
    if (row.hunkId) onSelect(row.hunkId);
  }, [onSelect]);

  // Scroll selected hunk into view when it changes (keyboard nav parity).
  useEffect(() => {
    if (!selectedHunkId) return;
    const range = hunkRowRanges.get(selectedHunkId);
    if (!range) return;
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-old-row="${range.first}"]`);
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedHunkId, hunkRowRanges]);

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12 text-xs text-zinc-500 italic">
        No changes detected.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="custom-scroll h-full min-h-0 overflow-auto bg-zinc-950/40 font-mono text-[11px] leading-relaxed"
    >
      <div className="grid grid-cols-[1fr_48px_1fr] items-stretch">
        {rows.map((row, idx) => {
          const isSelectedHunk = !!row.hunkId && row.hunkId === selectedHunkId;
          const range = row.hunkId ? hunkRowRanges.get(row.hunkId) : undefined;
          const isFirstRowOfHunk = !!range && range.first === idx;
          const decision = row.hunkId ? (decisions.get(row.hunkId) ?? "pending") : undefined;
          const isHovered = hoveredRow === idx;
          const isChangedRow = row.kind !== "unchanged";
          const canLineControl = !!row.hunkId && splittableHunkIds.has(row.hunkId) && isChangedRow;
          const showLineControls = canLineControl && isHovered && !isFirstRowOfHunk;

          // Determine line override for this row (when applicable).
          let currentOverride: boolean | undefined;
          if (canLineControl && row.hunkId) {
            const overrideMap = lineDecisions.get(row.hunkId);
            const line = row.old?.kind === "removed" ? row.old : row.new;
            if (line) {
              const lineIdx = hunkLineIndex.get(row.hunkId)?.get(line);
              if (lineIdx !== undefined && overrideMap) {
                currentOverride = overrideMap.get(lineIdx);
              }
            }
          }

          // Connector band color (per-row cell background in the gutter).
          const bandColor = decision === "accepted"
            ? "bg-emerald-500/40"
            : decision === "rejected"
              ? "bg-red-500/40"
              : range?.hasModified
                ? "bg-amber-500/40"
                : "bg-zinc-500/40";

          return (
            <div
              key={`row-${idx}`}
              className="contents"
              onMouseEnter={() => setHoveredRow(idx)}
              onMouseLeave={() => setHoveredRow((prev) => (prev === idx ? null : prev))}
            >
              {/* Old side */}
              <SideCell
                side="old"
                row={row}
                idx={idx}
                isSelectedHunk={isSelectedHunk}
                onClick={() => handleRowClick(row)}
              />

              {/* Gutter cell */}
              <div
                onClick={() => row.hunkId && onSelect(row.hunkId)}
                className={cn(
                  "relative flex min-h-[1.5rem] items-stretch border-x border-zinc-800/60 bg-zinc-900/40",
                  row.hunkId && "cursor-pointer",
                )}
              >
                {/* Connector band — fills the cell vertically, centered 1px line. */}
                {row.hunkId && (
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2",
                      bandColor,
                    )}
                  />
                )}
                {/* Selected-hunk left-edge accent. */}
                {isSelectedHunk && (
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute left-0 top-0 h-full w-0.5",
                      decision === "accepted"
                        ? "bg-emerald-500"
                        : decision === "rejected"
                          ? "bg-red-500"
                          : "bg-violet-500",
                    )}
                  />
                )}

                {/* First-row-of-hunk: hunk-level Accept/Reject buttons.
                    Always visible (no hover gate), sit above the band (z-10). */}
                {isFirstRowOfHunk && row.hunkId && (
                  <div className="relative z-10 flex w-full items-center justify-center gap-0.5 py-0.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (row.hunkId) onAccept(row.hunkId); }}
                      title="Accept hunk (Y)"
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border bg-zinc-900/90 backdrop-blur-sm transition-colors",
                        decision === "accepted"
                          ? "border-emerald-500 bg-emerald-600/50 text-emerald-100"
                          : "border-zinc-700 text-zinc-400 hover:border-emerald-500 hover:bg-emerald-950/60 hover:text-emerald-200",
                      )}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (row.hunkId) onReject(row.hunkId); }}
                      title="Reject hunk (N)"
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border bg-zinc-900/90 backdrop-blur-sm transition-colors",
                        decision === "rejected"
                          ? "border-red-500 bg-red-900/70 text-red-100"
                          : "border-zinc-700 text-zinc-400 hover:border-red-500 hover:bg-red-950/60 hover:text-red-200",
                      )}
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                {/* Hover line-level controls (splittable hunks, non-first rows). */}
                {!isFirstRowOfHunk && showLineControls && row.hunkId && (
                  <div className="relative z-10 flex w-full items-center justify-center gap-0.5 py-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const hunkId = row.hunkId;
                        if (!hunkId) return;
                        const line = row.old?.kind === "removed" ? row.old : row.new;
                        if (!line) return;
                        const lineIdx = hunkLineIndex.get(hunkId)?.get(line);
                        if (lineIdx === undefined) return;
                        onToggleLine(hunkId, lineIdx, true);
                      }}
                      title="Accept line"
                      className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-400 transition-colors hover:border-emerald-500 hover:bg-emerald-950/40 hover:text-emerald-200"
                    >
                      <Check size={9} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const hunkId = row.hunkId;
                        if (!hunkId) return;
                        const line = row.old?.kind === "removed" ? row.old : row.new;
                        if (!line) return;
                        const lineIdx = hunkLineIndex.get(hunkId)?.get(line);
                        if (lineIdx === undefined) return;
                        onToggleLine(hunkId, lineIdx, false);
                      }}
                      title="Reject line"
                      className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-400 transition-colors hover:border-red-500 hover:bg-red-950/40 hover:text-red-200"
                    >
                      <X size={9} />
                    </button>
                    {currentOverride !== undefined && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (row.hunkId) onResetLines(row.hunkId); }}
                        title="Revert line overrides"
                        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-400 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        <RotateCcw size={8} />
                      </button>
                    )}
                  </div>
                )}

                {/* Default decoration on change rows without buttons. */}
                {!isFirstRowOfHunk && !showLineControls && isChangedRow && (
                  <div className="relative z-10 flex w-full items-center justify-center text-zinc-600">
                    {row.kind === "added" ? (
                      <ChevronRight size={10} />
                    ) : row.kind === "removed" ? (
                      <ChevronLeft size={10} />
                    ) : (
                      // modified
                      <span className="text-amber-500/80" aria-hidden>~</span>
                    )}
                  </div>
                )}
              </div>

              {/* New side */}
              <SideCell
                side="new"
                row={row}
                idx={idx}
                isSelectedHunk={isSelectedHunk}
                onClick={() => handleRowClick(row)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SideCell ───────────────────────────────────────────────────────────────

interface SideCellProps {
  side: "old" | "new";
  row: AlignedRow;
  idx: number;
  isSelectedHunk: boolean;
  onClick: () => void;
}

function SideCell({ side, row, idx, isSelectedHunk, onClick }: SideCellProps) {
  const line = side === "old" ? row.old : row.new;
  const isEmptyPad = line === null;
  // Row-level kind drives the tint so paired "modified" rows use amber on
  // both sides; one-sided rows keep their plain add/remove tint.
  const rowKind = row.kind;

  const rowBg = isEmptyPad
    ? "bg-zinc-950/60"
    : rowKind === "modified"
      ? "bg-amber-950/25"
      : rowKind === "removed"
        ? side === "old"
          ? "bg-red-950/30"
          : ""
        : rowKind === "added"
          ? side === "new"
            ? "bg-emerald-950/30"
            : ""
          : "";
  const textTone = isEmptyPad
    ? ""
    : rowKind === "modified"
      ? "text-amber-200"
      : line?.kind === "removed"
        ? "text-red-200"
        : line?.kind === "added"
          ? "text-emerald-200"
          : "text-zinc-400";

  const lineNo = side === "old" ? line?.oldLineNo : line?.newLineNo;

  // Change prefix (+/−/~).
  const prefix = !isEmptyPad && rowKind !== "unchanged"
    ? renderPrefix(rowKind, line?.kind)
    : null;

  // Data-attributes so keyboard scroll-into-view can target the first row of
  // a hunk on either side.
  const rowAttr = side === "old"
    ? { "data-old-row": idx }
    : { "data-new-row": idx };

  // Fixed-width line-number slot on the inner edge of each side. The slot
  // itself is `h-6` aligned to the top — so on wrapped continuation lines
  // the slot stays visible as a blank gutter seat while the text wraps
  // underneath. No synthetic rows.
  const lineNoCell = (
    <span
      aria-hidden={isEmptyPad}
      className={cn(
        "block h-6 w-10 shrink-0 select-none self-start tabular-nums text-zinc-600",
        side === "old" ? "pl-2 pr-2 text-right" : "pl-2 pr-2 text-left",
      )}
    >
      {lineNo ?? ""}
    </span>
  );

  const textCell = (
    <span className="min-w-0 select-text whitespace-pre-wrap break-words py-0 leading-6">
      {prefix}
      {isEmptyPad ? "" : (line?.text || " ")}
    </span>
  );

  return (
    <div
      {...rowAttr}
      onClick={onClick}
      className={cn(
        "grid min-h-[1.5rem] cursor-pointer items-start py-0.5 text-zinc-400",
        // old: [text | lineNo]; new: [lineNo | text]
        side === "old" ? "grid-cols-[1fr_auto]" : "grid-cols-[auto_1fr]",
        rowBg,
        textTone,
        isSelectedHunk && "bg-zinc-800/40",
        !row.hunkId && "cursor-default",
      )}
    >
      {side === "old" ? (
        <>
          {textCell}
          {lineNoCell}
        </>
      ) : (
        <>
          {lineNoCell}
          {textCell}
        </>
      )}
    </div>
  );
}

function renderPrefix(rowKind: AlignedRow["kind"], lineKind: HunkLine["kind"] | undefined) {
  if (rowKind === "unchanged") return null;
  let char = " ";
  let color = "text-zinc-500";
  if (rowKind === "modified") {
    char = "~";
    color = "text-amber-500";
  } else if (lineKind === "removed" || (rowKind === "removed" && !lineKind)) {
    char = "−";
    color = "text-red-500";
  } else if (lineKind === "added" || (rowKind === "added" && !lineKind)) {
    char = "+";
    color = "text-emerald-500";
  }
  return (
    <span className={cn("mr-2 inline-block w-3 select-none text-center", color)}>
      {char}
    </span>
  );
}

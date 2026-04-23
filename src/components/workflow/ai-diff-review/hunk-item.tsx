"use client";

import { useState } from "react";
import { Check, X, ChevronDown, ChevronRight, SplitSquareHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Hunk, HunkDecision } from "@/lib/diff/types";

interface HunkItemProps {
  hunk: Hunk;
  index: number;
  total: number;
  selected: boolean;
  decision: HunkDecision;
  lineOverrides: Map<number, boolean>;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggleLine: (lineIndex: number, accepted: boolean) => void;
  onResetLines: () => void;
}

export function HunkItem({
  hunk,
  index,
  total,
  selected,
  decision,
  lineOverrides,
  onSelect,
  onAccept,
  onReject,
  onToggleLine,
  onResetLines,
}: HunkItemProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const [perLineOpen, setPerLineOpen] = useState(false);

  const statusChip = decision === "accepted"
    ? "border-emerald-600/60 text-emerald-300 bg-emerald-950/30"
    : decision === "rejected"
      ? "border-red-700/50 text-red-300 bg-red-950/30"
      : "border-zinc-700/60 text-zinc-400 bg-zinc-800/40";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-xl border bg-zinc-900/50 transition-all",
        selected ? "border-violet-600/40 shadow-[0_0_0_1px_rgba(139,92,246,0.15)]" : "border-zinc-800/60",
      )}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50">
        <span className="text-[10px] text-zinc-500 tabular-nums font-mono">
          {index + 1}/{total}
        </span>
        <span className="text-[11px] text-zinc-400">
          line {hunk.startOldLine}
          {hunk.lines.filter((l) => l.kind === "removed").length > 1
            ? `–${hunk.startOldLine + hunk.lines.filter((l) => l.kind === "removed").length - 1}`
            : ""}
        </span>
        <span className={cn("text-[10px] uppercase tracking-wider font-medium rounded-full px-2 py-0.5 border", statusChip)}>
          {decision}
        </span>

        <div className="flex-1" />

        {hunk.splittable && hunk.lines.filter((l) => l.kind !== "unchanged").length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPerLineOpen((v) => !v); if (!perLineOpen) onResetLines(); }}
            title="Per line"
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors border",
              perLineOpen
                ? "bg-violet-600/20 text-violet-200 border-violet-600/40"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 border-transparent",
            )}
          >
            <SplitSquareHorizontal size={11} /> Per line
          </button>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAccept(); }}
          title="Accept (Y)"
          className={cn(
            "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors border",
            decision === "accepted"
              ? "bg-emerald-600/20 text-emerald-200 border-emerald-600/40"
              : "text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/30 border-transparent",
          )}
        >
          <Check size={11} /> Accept
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReject(); }}
          title="Reject (N)"
          className={cn(
            "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors border",
            decision === "rejected"
              ? "bg-red-950/40 text-red-300 border-red-700/50"
              : "text-zinc-400 hover:text-red-300 hover:bg-red-950/30 border-transparent",
          )}
        >
          <X size={11} /> Reject
        </button>
      </div>

      {/* ── Context before (collapsed by default) ─────────────── */}
      {hunk.contextBefore.length > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setContextOpen((v) => !v); }}
          className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 w-full text-left border-b border-zinc-800/40"
        >
          {contextOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          … {hunk.contextBefore.length} lines of context
        </button>
      )}

      {contextOpen && hunk.contextBefore.length > 0 && (
        <div className="font-mono text-[11px] text-zinc-500 bg-zinc-950/40 border-b border-zinc-800/40">
          {hunk.contextBefore.map((line, i) => (
            <div key={`ctx-before-${i}`} className="px-3 py-0.5 whitespace-pre">
              <span className="text-zinc-700 select-none mr-2"> </span>
              {line || " "}
            </div>
          ))}
        </div>
      )}

      {/* ── Change lines ──────────────────────────────────────── */}
      <div className="font-mono text-[11px] leading-relaxed">
        {hunk.lines.map((line, i) => {
          if (line.kind === "unchanged") {
            return (
              <div key={`ln-${i}`} className="px-3 py-0.5 whitespace-pre text-zinc-500 bg-zinc-950/30">
                <span className="text-zinc-700 select-none mr-2"> </span>
                {line.text || " "}
              </div>
            );
          }
          const isRemoved = line.kind === "removed";
          const override = lineOverrides.get(i);
          const showControl = perLineOpen && hunk.splittable;
          return (
            <div
              key={`ln-${i}`}
              className={cn(
                "px-3 py-0.5 whitespace-pre flex items-center gap-2",
                isRemoved ? "bg-red-950/25 text-red-200" : "bg-emerald-950/25 text-emerald-200",
              )}
            >
              <span className={cn("select-none", isRemoved ? "text-red-500" : "text-emerald-500")}>
                {isRemoved ? "−" : "+"}
              </span>
              <span className="flex-1 break-all">
                {line.text || " "}
              </span>
              {showControl && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleLine(i, !(override ?? false)); }}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider border transition-colors",
                    override === true
                      ? "bg-emerald-600/20 text-emerald-200 border-emerald-600/40"
                      : override === false
                        ? "bg-red-950/40 text-red-300 border-red-700/50"
                        : "text-zinc-500 border-zinc-700/50 hover:text-zinc-200",
                  )}
                >
                  {override === true ? "keep new" : override === false ? "keep old" : "decide"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Context after (collapsed by default) ──────────────── */}
      {hunk.contextAfter.length > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setContextOpen((v) => !v); }}
          className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 w-full text-left border-t border-zinc-800/40"
        >
          {contextOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          … {hunk.contextAfter.length} lines of context
        </button>
      )}

      {contextOpen && hunk.contextAfter.length > 0 && (
        <div className="font-mono text-[11px] text-zinc-500 bg-zinc-950/40">
          {hunk.contextAfter.map((line, i) => (
            <div key={`ctx-after-${i}`} className="px-3 py-0.5 whitespace-pre">
              <span className="text-zinc-700 select-none mr-2"> </span>
              {line || " "}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

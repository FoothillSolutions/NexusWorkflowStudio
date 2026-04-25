"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodePreview } from "@/components/ui/code-preview";

interface MergedPreviewProps {
  merged: string;
  isScript: boolean;
  scriptLanguage?: string;
  /**
   * `side` (default) — renders as a side panel column with its own collapsible
   * chrome. `bottom` — retains the previous small collapsible style for smaller
   * viewports.
   */
  variant?: "side" | "bottom";
  /**
   * Only used in `side` variant — lets the parent toggle the panel's
   * visibility from an external button without tearing down the component.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MergedPreview({
  merged,
  isScript,
  scriptLanguage = "typescript",
  variant = "side",
  open: controlledOpen,
  onOpenChange,
}: MergedPreviewProps) {
  const [internalOpen, setInternalOpen] = useState(variant === "side");
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };

  // ── Side-panel variant ─────────────────────────────────────────────────────
  if (variant === "side") {
    if (!open) {
      // Collapsed rail — a thin vertical strip that can be clicked to reopen.
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Show merged result"
          className="flex h-full w-8 shrink-0 flex-col items-center gap-2 border-l border-zinc-800/60 bg-zinc-950/30 py-3 text-zinc-500 transition-colors hover:bg-zinc-900/60 hover:text-zinc-300"
        >
          <PanelRightOpen size={13} />
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Merged result
          </span>
        </button>
      );
    }
    return (
      <div className="flex h-full min-h-0 w-[440px] shrink-0 flex-col border-l border-zinc-800/60 bg-zinc-950/30">
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
          <FileText size={12} className="text-zinc-500" />
          <span className="text-[11px] font-semibold text-zinc-200">Merged result</span>
          <span className="ml-auto tabular-nums text-[10px] text-zinc-600">{merged.length} chars</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Hide merged result"
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            <PanelRightClose size={12} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto custom-scroll">
          {isScript ? (
            <CodePreview value={merged} language={scriptLanguage} className="p-3" emptyMessage="No content." />
          ) : merged.length > 0 ? (
            <pre className="m-0 whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
              {merged}
            </pre>
          ) : (
            <div className="px-3 py-3 text-xs italic text-zinc-600">No content.</div>
          )}
        </div>
      </div>
    );
  }

  // ── Bottom / compact collapsible variant (legacy) ──────────────────────────
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-800/30",
          open && "bg-zinc-800/20 border-b border-zinc-800/40",
        )}
      >
        {open ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-500" />}
        <FileText size={12} className="text-zinc-500" />
        <span className="text-[11px] font-medium text-zinc-300">Preview merged result</span>
        <span className="text-[10px] text-zinc-600 ml-auto tabular-nums">{merged.length} chars</span>
      </button>
      {open && (
        <div className="max-h-64 overflow-auto custom-scroll">
          {isScript ? (
            <CodePreview value={merged} language={scriptLanguage} className="p-3" emptyMessage="No content." />
          ) : merged.length > 0 ? (
            <pre className="custom-scroll p-3 m-0 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
              {merged}
            </pre>
          ) : (
            <div className="px-3 py-3 text-xs italic text-zinc-600">No content.</div>
          )}
        </div>
      )}
    </div>
  );
}

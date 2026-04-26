"use client";

import { AlertCircle, Pin, RefreshCw, Trash2 } from "lucide-react";
import type { ResearchBlock } from "@/lib/research/types";

interface TileCardProps {
  block: ResearchBlock;
  selected?: boolean;
  onChange: (patch: Partial<ResearchBlock>) => void;
  onDelete: () => void;
  onSelect: () => void;
}

export function TileCard({ block, selected, onChange, onDelete, onSelect }: TileCardProps) {
  return (
    <article className={`rounded-xl border bg-zinc-950/80 p-4 shadow-lg ${selected ? "border-cyan-400" : "border-zinc-800"}`}>
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-zinc-400">
        <button type="button" onClick={onSelect} className="rounded bg-zinc-900 px-2 py-1 uppercase tracking-wide hover:text-zinc-100">{block.contentType}</button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onChange({ pinned: !block.pinned })} className="rounded p-1 hover:bg-zinc-800" aria-label="Pin tile"><Pin className={`h-4 w-4 ${block.pinned ? "text-amber-300" : ""}`} /></button>
          <button type="button" onClick={onDelete} className="rounded p-1 hover:bg-zinc-800" aria-label="Delete tile"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <textarea value={block.content} onChange={(event) => onChange({ content: event.target.value })} className="min-h-24 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-100 outline-none focus:border-cyan-500" />
      <div className="mt-3 text-sm text-zinc-300">{block.annotation || "No annotation yet."}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>{block.category || "General"}</span>
        <span>{Math.round(block.confidence * 100)}% confidence</span>
        {block.influencedByBlockIds.length > 0 && <span>{block.influencedByBlockIds.length} links</span>}
      </div>
      {block.tasks.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-zinc-300">
          {block.tasks.map((task) => <li key={task.id}>[{task.done ? "x" : " "}] {task.text}</li>)}
        </ul>
      )}
      {block.aiError && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{block.aiError}</span>
          <button type="button" onClick={() => onChange({ aiError: "AI not connected" })} className="inline-flex items-center gap-1 rounded bg-amber-400/20 px-2 py-1 hover:bg-amber-400/30"><RefreshCw className="h-3 w-3" /> Re-enrich</button>
        </div>
      )}
    </article>
  );
}

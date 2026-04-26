"use client";

import type { ResearchBlock } from "@/lib/research/types";

export function TileIndex({ blocks, onSelect }: { blocks: ResearchBlock[]; onSelect: (id: string) => void }) {
  return (
    <aside className="hidden w-64 shrink-0 border-l border-zinc-800 bg-zinc-950 p-4 lg:block">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Tile index</h3>
      <div className="space-y-2">
        {blocks.map((block) => <button key={block.id} type="button" onClick={() => onSelect(block.id)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-left text-xs text-zinc-300 hover:border-cyan-500"><span className="block text-zinc-500">{block.contentType}</span><span className="line-clamp-2">{block.content}</span></button>)}
      </div>
    </aside>
  );
}

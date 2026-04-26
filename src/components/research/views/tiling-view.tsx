"use client";

import { TileCard } from "../tile-card";
import type { ResearchBlock } from "@/lib/research/types";

interface TilingViewProps {
  blocks: ResearchBlock[];
  selectedBlockIds: string[];
  onUpdateBlock: (id: string, patch: Partial<ResearchBlock>) => void;
  onDeleteBlock: (id: string) => void;
  onSelectBlock: (id: string) => void;
}

export function TilingView({ blocks, selectedBlockIds, onUpdateBlock, onDeleteBlock, onSelectBlock }: TilingViewProps) {
  if (!blocks.length) return <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">No tiles yet. Add one from the command input.</div>;
  return (
    <div className="grid auto-rows-min grid-cols-1 gap-4 xl:grid-cols-2">
      {blocks.map((block) => <TileCard key={block.id} block={block} selected={selectedBlockIds.includes(block.id)} onChange={(patch) => onUpdateBlock(block.id, patch)} onDelete={() => onDeleteBlock(block.id)} onSelect={() => onSelectBlock(block.id)} />)}
    </div>
  );
}

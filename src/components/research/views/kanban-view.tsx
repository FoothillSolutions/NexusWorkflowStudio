"use client";

import type { ResearchBlock } from "@/lib/research/types";

export function KanbanView({ blocks }: { blocks: ResearchBlock[] }) {
  const groups = Array.from(new Set(blocks.map((block) => block.category || block.contentType)));
  return (
    <div className="grid min-h-[60vh] grid-cols-1 gap-4 lg:grid-cols-3">
      {(groups.length ? groups : ["Inbox"]).map((group) => (
        <section key={group} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">{group}</h3>
          <div className="space-y-3">
            {blocks.filter((block) => (block.category || block.contentType) === group).map((block) => (
              <div key={block.id} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
                <div className="text-xs uppercase text-zinc-500">{block.contentType}</div>
                {block.content}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

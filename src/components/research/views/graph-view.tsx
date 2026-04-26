"use client";

import type { ResearchBlock } from "@/lib/research/types";

export function GraphView({ blocks }: { blocks: ResearchBlock[] }) {
  const positions = blocks.map((block, index) => {
    const angle = (index / Math.max(blocks.length, 1)) * Math.PI * 2;
    return { block, x: 300 + Math.cos(angle) * 220, y: 260 + Math.sin(angle) * 180 };
  });
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70">
      <svg viewBox="0 0 600 520" className="h-[65vh] w-full">
        {positions.flatMap(({ block, x, y }) => block.influencedByBlockIds.map((id) => {
          const target = positions.find((item) => item.block.id === id);
          if (!target) return null;
          return <line key={`${block.id}-${id}`} x1={x} y1={y} x2={target.x} y2={target.y} stroke="#155e75" strokeWidth="2" />;
        }))}
        {positions.map(({ block, x, y }) => (
          <g key={block.id} transform={`translate(${x}, ${y})`}>
            <circle r="34" fill="#18181b" stroke={block.pinned ? "#fbbf24" : "#22d3ee"} />
            <text textAnchor="middle" y="4" fill="#e4e4e7" fontSize="10">{block.contentType}</text>
            <title>{block.content}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

"use client";

import type { ResearchSynthesis } from "@/lib/research/types";

export function SynthesisPanel({ syntheses }: { syntheses: ResearchSynthesis[] }) {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">Synthesis</h3>
      {syntheses.length === 0 ? <p className="text-sm text-zinc-500">No synthesis generated yet.</p> : syntheses.map((item) => (
        <article key={item.id} className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="mb-2 flex items-center justify-between"><h4 className="font-medium text-zinc-100">{item.title}</h4><button type="button" onClick={() => navigator.clipboard?.writeText(item.content)} className="text-xs text-cyan-300">Copy</button></div>
          <pre className="whitespace-pre-wrap text-sm text-zinc-300">{item.content}</pre>
        </article>
      ))}
    </section>
  );
}

"use client";

import { RESEARCH_TEMPLATE_IDS, getResearchTemplateName } from "@/lib/research/templates";
import type { ResearchTemplateId } from "@/lib/research/types";

export function TemplatePicker({ onCreate }: { onCreate: (templateId: ResearchTemplateId) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Planning templates</h3>
      {RESEARCH_TEMPLATE_IDS.map((id) => <button key={id} type="button" onClick={() => onCreate(id)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-left text-sm text-zinc-200 hover:border-cyan-500">{getResearchTemplateName(id)}</button>)}
    </div>
  );
}

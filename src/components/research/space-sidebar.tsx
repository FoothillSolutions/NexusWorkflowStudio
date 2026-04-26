"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ResearchSpaceRecord, ResearchTemplateId } from "@/lib/research/types";
import { TemplatePicker } from "./template-picker";
import { ImportExportMenu } from "./import-export-menu";

export function SpaceSidebar({ spaces, activeId, onSelect, onCreate, onCreateTemplate, onDelete }: { spaces: ResearchSpaceRecord[]; activeId?: string; onSelect: (id: string) => void; onCreate: () => void; onCreateTemplate: (id: ResearchTemplateId) => void; onDelete: (id: string) => void }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 border-r border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-100">Research</h2>
        <button type="button" onClick={onCreate} className="rounded-lg bg-cyan-500 p-2 text-zinc-950"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2">
        {spaces.map((space) => (
          <div key={space.id} className={`group flex items-center gap-2 rounded-lg border px-3 py-2 ${activeId === space.id ? "border-cyan-500 bg-cyan-500/10" : "border-zinc-800 bg-zinc-900/50"}`}>
            <button type="button" onClick={() => onSelect(space.id)} className="min-w-0 flex-1 text-left"><div className="truncate text-sm text-zinc-200">{space.name}</div><div className="text-xs text-zinc-500">{space.blockCount} tiles</div></button>
            <button type="button" onClick={() => onDelete(space.id)} className="text-zinc-500 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <TemplatePicker onCreate={onCreateTemplate} />
      <ImportExportMenu />
    </aside>
  );
}

"use client";

import type { ResearchViewMode } from "@/lib/research/types";

export function StatusBar({ workspaceId, spaceName, syncStatus, aiStatus, viewMode, onViewMode }: { workspaceId: string; spaceName: string; syncStatus: string; aiStatus: string; viewMode: ResearchViewMode; onViewMode: (mode: ResearchViewMode) => void }) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 text-xs text-zinc-400">
      <div className="flex items-center gap-3"><span>Workspace {workspaceId}</span><span>/</span><span className="text-zinc-200">{spaceName}</span></div>
      <div className="flex items-center gap-3">
        <span>Sync: {syncStatus}</span><span>AI: {aiStatus === "error" ? "AI not connected" : aiStatus}</span>
        <div className="rounded-lg border border-zinc-800 p-0.5">
          {(["tiling", "kanban", "graph"] as ResearchViewMode[]).map((mode) => <button key={mode} type="button" onClick={() => onViewMode(mode)} className={`rounded px-2 py-1 ${viewMode === mode ? "bg-cyan-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}>{mode}</button>)}
        </div>
      </div>
    </div>
  );
}

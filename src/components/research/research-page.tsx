"use client";

import { useEffect } from "react";
import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import { getResearchSpaceClient, saveResearchSpaceClient } from "@/lib/research/client";
import { exportResearchMarkdown } from "@/lib/research/markdown-export";
import { serializeNodepad } from "@/lib/research/nodepad-format";
import type { ResearchTemplateId } from "@/lib/research/types";
import { useResearchStore } from "@/store/research-store";
import { useResearchSpaces } from "@/hooks/use-research-spaces";
import { useResearchAutosave } from "@/hooks/use-research-autosave";
import { useResearchCollaboration } from "@/hooks/use-research-collaboration";
import { CommandInput } from "./command-input";
import { PromoteMenu } from "./promote-menu";
import { SpaceSidebar } from "./space-sidebar";
import { StatusBar } from "./status-bar";
import { SynthesisPanel } from "./synthesis-panel";
import { TileIndex } from "./tile-index";
import { GraphView } from "./views/graph-view";
import { KanbanView } from "./views/kanban-view";
import { TilingView } from "./views/tiling-view";

export function ResearchPage({ workspaceId }: { workspaceId: string }) {
  const { spaces, isLoading, error, createSpace, deleteSpace } = useResearchSpaces(workspaceId);
  const { activeSpace, setActiveSpace, viewMode, setViewMode, addBlock, updateBlock, deleteBlock, selectedBlockIds, toggleSelected, aiStatus } = useResearchStore();
  useResearchAutosave(workspaceId, activeSpace);
  const collab = useResearchCollaboration(workspaceId, activeSpace, setActiveSpace);

  useEffect(() => {
    if (!activeSpace && spaces[0]) void getResearchSpaceClient(workspaceId, spaces[0].id).then(setActiveSpace).catch(() => undefined);
  }, [activeSpace, spaces, workspaceId, setActiveSpace]);

  const openSpace = async (id: string) => setActiveSpace(await getResearchSpaceClient(workspaceId, id));
  const createBlank = async () => setActiveSpace(await createSpace("Untitled Research Space"));
  const createTemplate = async (templateId: ResearchTemplateId) => setActiveSpace(await createSpace(templateId.replaceAll("-", " "), templateId));
  const saveNow = async () => { if (activeSpace) setActiveSpace(await saveResearchSpaceClient(workspaceId, activeSpace)); };
  const copyMarkdown = async () => { if (activeSpace) await navigator.clipboard?.writeText(exportResearchMarkdown(activeSpace)); };
  const downloadText = (name: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <StatusBar workspaceId={workspaceId} spaceName={activeSpace?.name ?? "No space"} syncStatus={collab.status} aiStatus={aiStatus === "idle" ? "AI not connected" : aiStatus} viewMode={viewMode} onViewMode={setViewMode} />
      <div className="flex min-h-0 flex-1">
        <SpaceSidebar spaces={spaces} activeId={activeSpace?.id} onSelect={(id) => void openSpace(id)} onCreate={() => void createBlank()} onCreateTemplate={(id) => void createTemplate(id)} onDelete={(id) => void deleteSpace(id)} />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <div className="flex items-center gap-3"><Link href={`/workspace/${workspaceId}`} className="text-zinc-400 hover:text-zinc-100"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="font-semibold">{activeSpace?.name ?? "Workspace Research"}</h1><p className="text-xs text-zinc-500">AI not connected — local-first notes, collaboration, import/export, and Brain promotion remain available.</p></div></div>
            <div className="flex items-center gap-2"><PromoteMenu workspaceId={workspaceId} space={activeSpace} /><button type="button" onClick={copyMarkdown} className="rounded-lg border border-zinc-700 p-2"><FileText className="h-4 w-4" /></button><button type="button" onClick={() => activeSpace && downloadText(`${activeSpace.name}.nodepad`, serializeNodepad(activeSpace))} className="rounded-lg border border-zinc-700 p-2"><Download className="h-4 w-4" /></button><button type="button" onClick={() => void saveNow()} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm">Save</button></div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            {isLoading && <p className="text-zinc-500">Loading research spaces…</p>}
            {error && <p className="text-red-300">{error}</p>}
            {!isLoading && !activeSpace && <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">No spaces yet. Create a blank space or choose a planning template.</div>}
            {activeSpace && viewMode === "tiling" && <TilingView blocks={activeSpace.blocks} selectedBlockIds={selectedBlockIds} onUpdateBlock={updateBlock} onDeleteBlock={deleteBlock} onSelectBlock={toggleSelected} />}
            {activeSpace && viewMode === "kanban" && <KanbanView blocks={activeSpace.blocks} />}
            {activeSpace && viewMode === "graph" && <GraphView blocks={activeSpace.blocks} />}
          </div>
          {activeSpace && <SynthesisPanel syntheses={activeSpace.syntheses} />}
          <CommandInput onSubmit={addBlock} />
        </main>
        {activeSpace && <TileIndex blocks={activeSpace.blocks} onSelect={toggleSelected} />}
      </div>
    </div>
  );
}

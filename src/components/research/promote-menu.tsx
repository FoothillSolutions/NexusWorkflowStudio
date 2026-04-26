"use client";

import { promoteResearchClient } from "@/lib/research/client";
import type { ResearchSpaceData } from "@/lib/research/types";

export function PromoteMenu({ workspaceId, space }: { workspaceId: string; space: ResearchSpaceData | null }) {
  const promote = async (target: "workspace" | "personal") => {
    if (!space) return;
    try {
      await promoteResearchClient(workspaceId, space.id, { target, blockIds: space.selectedBlockIds });
      window.alert(`Promoted to ${target === "workspace" ? "Workspace Brain" : "Personal Brain"}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Promotion failed");
    }
  };
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => promote("workspace")} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-zinc-950">Promote to Workspace Brain</button>
      <button type="button" onClick={() => promote("personal")} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200">Personal Brain</button>
    </div>
  );
}

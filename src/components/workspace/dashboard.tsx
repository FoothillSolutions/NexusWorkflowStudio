"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Search } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { addRecentWorkspace } from "@/lib/workspace/local-history";
import { BG_APP, TEXT_PRIMARY, TEXT_MUTED, BORDER_DEFAULT } from "@/lib/theme";
import { WorkspaceHeader } from "./workspace-header";
import { WorkflowCard } from "./workflow-card";
import { EmptyState } from "./empty-state";

interface WorkspaceDashboardProps {
  workspaceId: string;
}

export function WorkspaceDashboard({ workspaceId }: WorkspaceDashboardProps) {
  const router = useRouter();
  const { workspace, workflows, isLoading, error, refetch } = useWorkspace(workspaceId);

  useEffect(() => {
    if (workspace) {
      addRecentWorkspace({
        id: workspace.id,
        name: workspace.name,
        workflowCount: workflows.length,
        memberNames: [],
        lastAccessedAt: new Date().toISOString(),
      });
    }
  }, [workspace, workflows.length]);

  const handleResearch = () => {
    router.push(`/workspace/${workspaceId}/research`);
  };

  const handleNewWorkflow = async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Workflow" }),
      });
      if (!res.ok) throw new Error("Failed to create workflow");
      const { workflow } = await res.json();
      router.push(`/workspace/${workspaceId}/workflow/${workflow.id}`);
    } catch {
      // toast error could go here
    }
  };

  if (isLoading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${BG_APP} ${TEXT_PRIMARY}`}>
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${BG_APP} ${TEXT_PRIMARY}`}>
        <p className={TEXT_MUTED}>{error ?? "Workspace not found"}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${BG_APP} ${TEXT_PRIMARY}`}>
      <WorkspaceHeader
        workspaceId={workspaceId}
        name={workspace.name}
        onNameChange={refetch}
      />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <Search className="h-5 w-5 text-cyan-300" />
                Workspace Research
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Collect notes, use planning templates, synthesize findings, and promote research into Brain.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResearch}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-cyan-400"
            >
              Open Research
            </button>
          </div>
        </div>

        {workflows.length === 0 ? (
          <EmptyState onCreateWorkflow={handleNewWorkflow} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workspaceId={workspaceId}
                workflow={wf}
                onDelete={refetch}
                onRename={refetch}
              />
            ))}

            <button
              type="button"
              onClick={handleNewWorkflow}
              className={`flex min-h-[140px] items-center justify-center rounded-xl border-2 border-dashed ${BORDER_DEFAULT} transition-colors hover:border-zinc-600 hover:bg-zinc-900/40`}
            >
              <div className={`flex flex-col items-center gap-2 ${TEXT_MUTED}`}>
                <Plus className="h-6 w-6" />
                <span className="text-sm">New Workflow</span>
              </div>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

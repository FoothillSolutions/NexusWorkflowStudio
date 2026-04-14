"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
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

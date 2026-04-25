"use client";

import { use, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import WorkflowEditor from "@/components/workflow/workflow-editor";
import { BG_APP, TEXT_PRIMARY, TEXT_MUTED } from "@/lib/theme";
import type { WorkflowJSON } from "@/types/workflow";

export default function WorkspaceWorkflowPage({
  params,
}: {
  params: Promise<{ id: string; wid: string }>;
}) {
  const { id, wid } = use(params);
  const [initialWorkflow, setInitialWorkflow] = useState<WorkflowJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/workspaces/${id}/workflows/${wid}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Workflow not found" : "Failed to load workflow");
          return;
        }
        const data: WorkflowJSON = await res.json();
        setInitialWorkflow(data);
      } catch {
        setError("Failed to load workflow");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, wid]);

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${BG_APP} ${TEXT_PRIMARY}`}>
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !initialWorkflow) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${BG_APP} ${TEXT_PRIMARY}`}>
        <p className={TEXT_MUTED}>{error ?? "Workflow not found"}</p>
      </div>
    );
  }

  return (
    <WorkflowEditor
      workspaceId={id}
      workflowId={wid}
      initialWorkflow={initialWorkflow}
    />
  );
}

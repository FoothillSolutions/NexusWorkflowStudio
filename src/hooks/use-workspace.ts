"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceManifest } from "@/lib/workspace/types";

interface UseWorkspaceResult {
  workspace: WorkspaceManifest["workspace"] | null;
  workflows: WorkspaceManifest["workflows"];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWorkspace(workspaceId: string): UseWorkspaceResult {
  const [workspace, setWorkspace] = useState<WorkspaceManifest["workspace"] | null>(null);
  const [workflows, setWorkflows] = useState<WorkspaceManifest["workflows"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Workspace not found" : "Failed to load workspace");
        return;
      }
      const data: WorkspaceManifest = await res.json();
      setWorkspace(data.workspace);
      setWorkflows(data.workflows);
    } catch {
      setError("Failed to load workspace");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  return { workspace, workflows, isLoading, error, refetch: fetchWorkspace };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkflowChanges } from "@/lib/workspace/types";

const LAST_SEEN_PREFIX = "nexus:workspace-last-seen:";

function getLastSeen(workspaceId: string): string {
  if (typeof window === "undefined") return new Date().toISOString();
  const stored = localStorage.getItem(LAST_SEEN_PREFIX + workspaceId);
  if (stored) return stored;
  // Default to 24 hours ago
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

interface UseWorkspaceChangesResult {
  changes: WorkflowChanges[];
  isLoading: boolean;
  since: string;
  markSeen: () => void;
}

export function useWorkspaceChanges(
  workspaceId: string,
  isReady: boolean,
): UseWorkspaceChangesResult {
  const [changes, setChanges] = useState<WorkflowChanges[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [since, setSince] = useState("");

  useEffect(() => {
    if (!isReady) return;

    const sinceValue = getLastSeen(workspaceId);
    setSince(sinceValue);

    let cancelled = false;

    async function fetchChanges() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/changes?since=${encodeURIComponent(sinceValue)}`,
        );
        if (!res.ok) {
          setChanges([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setChanges(data.changes ?? []);
        }
      } catch {
        if (!cancelled) setChanges([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchChanges();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, isReady]);

  const markSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LAST_SEEN_PREFIX + workspaceId, new Date().toISOString());
  }, [workspaceId]);

  return { changes, isLoading, since, markSeen };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { createResearchSpaceClient, deleteResearchSpaceClient, listResearchSpacesClient } from "@/lib/research/client";
import type { ResearchSpaceRecord, ResearchTemplateId } from "@/lib/research/types";

export function useResearchSpaces(workspaceId: string) {
  const [spaces, setSpaces] = useState<ResearchSpaceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSpaces(await listResearchSpacesClient(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load research spaces");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void refetch(); }, [refetch]);

  const createSpace = useCallback(async (name: string, templateId?: ResearchTemplateId | null) => {
    const space = await createResearchSpaceClient(workspaceId, { name, templateId });
    await refetch();
    return space;
  }, [workspaceId, refetch]);

  const deleteSpace = useCallback(async (spaceId: string) => {
    await deleteResearchSpaceClient(workspaceId, spaceId);
    await refetch();
  }, [workspaceId, refetch]);

  return { spaces, isLoading, error, refetch, createSpace, deleteSpace };
}

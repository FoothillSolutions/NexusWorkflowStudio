"use client";

import { useEffect } from "react";
import { useOpenCodeStore } from "@/store/opencode-store";
import type { ModelGroup, DynamicModel } from "@/store/opencode-store";

// Re-export types so existing imports from hooks still work
export type { ModelGroup, DynamicModel };

export interface UseModelsResult {
  /** Grouped models fetched from OpenCode */
  groups: ModelGroup[];
  /** Whether the fetch is in progress */
  isLoading: boolean;
  /** True when not connected — dropdown should be locked to "inherit" */
  isDisabled: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useModels(): UseModelsResult {
  const status = useOpenCodeStore((s) => s.status);
  const modelGroups = useOpenCodeStore((s) => s.modelGroups);
  const modelGroupsLoading = useOpenCodeStore((s) => s.modelGroupsLoading);
  const fetchModelGroups = useOpenCodeStore((s) => s.fetchModelGroups);

  const isConnected = status === "connected";

  // Trigger fetch when connected and not yet loaded
  useEffect(() => {
    if (isConnected) {
      fetchModelGroups();
    }
  }, [isConnected, fetchModelGroups]);

  return {
    groups: isConnected ? modelGroups : [],
    isLoading: modelGroupsLoading,
    isDisabled: !isConnected,
  };
}

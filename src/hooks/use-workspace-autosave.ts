"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkflowStore } from "@/store/workflow";
import { stripTransientProperties } from "@/lib/persistence";

const DEBOUNCE_MS = 30_000;

interface AutosaveConfig {
  workspaceId: string;
  workflowId: string;
  displayName: string;
}

interface AutosaveState {
  isSaving: boolean;
  lastSavedAt: string | null;
}

export function useWorkspaceAutosave(config: AutosaveConfig | null): AutosaveState {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const save = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg) return;

    const state = useWorkflowStore.getState();
    const snapshot = stripTransientProperties({
      name: state.name,
      nodes: state.nodes,
      edges: state.edges,
      ui: {
        sidebarOpen: state.sidebarOpen,
        minimapVisible: state.minimapVisible,
        viewport: state.viewport,
        canvasMode: state.canvasMode,
        edgeStyle: state.edgeStyle,
      },
    });

    setIsSaving(true);
    try {
      await fetch(`/api/workspaces/${cfg.workspaceId}/workflows/${cfg.workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: snapshot, lastModifiedBy: cfg.displayName }),
      });
      setLastSavedAt(new Date().toISOString());
    } catch {
      // best-effort
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Subscribe to store changes and debounce saves
  useEffect(() => {
    if (!config) return;

    let prevNodes = useWorkflowStore.getState().nodes;
    let prevEdges = useWorkflowStore.getState().edges;
    let prevName = useWorkflowStore.getState().name;

    const unsub = useWorkflowStore.subscribe((state) => {
      if (
        state.nodes === prevNodes &&
        state.edges === prevEdges &&
        state.name === prevName
      ) return;

      prevNodes = state.nodes;
      prevEdges = state.edges;
      prevName = state.name;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [config, save]);

  // Best-effort save on unload
  useEffect(() => {
    if (!config) return;

    const handleUnload = () => {
      const cfg = configRef.current;
      if (!cfg) return;

      const state = useWorkflowStore.getState();
      const snapshot = stripTransientProperties({
        name: state.name,
        nodes: state.nodes,
        edges: state.edges,
        ui: {
          sidebarOpen: state.sidebarOpen,
          minimapVisible: state.minimapVisible,
          viewport: state.viewport,
          canvasMode: state.canvasMode,
          edgeStyle: state.edgeStyle,
        },
      });

      const url = `/api/workspaces/${cfg.workspaceId}/workflows/${cfg.workflowId}`;
      const body = JSON.stringify({ data: snapshot, lastModifiedBy: cfg.displayName });

      // Use fetch with keepalive for best-effort unload save
      fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {/* ignore */});
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [config]);

  return { isSaving, lastSavedAt };
}

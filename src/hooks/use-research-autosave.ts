"use client";

import { useEffect, useRef } from "react";
import { prepareResearchAutosaveSnapshot } from "@/lib/research/collaboration";
import type { ResearchSpaceData } from "@/lib/research/types";

export function useResearchAutosave(workspaceId: string, space: ResearchSpaceData | null, delayMs = 1200) {
  const latest = useRef<ResearchSpaceData | null>(space);

  useEffect(() => {
    latest.current = space;
  }, [space]);

  useEffect(() => {
    if (!space) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const snapshot = latest.current ? prepareResearchAutosaveSnapshot(latest.current) : null;
      if (!snapshot) return;
      void fetch(`/api/workspaces/${workspaceId}/research-spaces/${snapshot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: snapshot, lastModifiedBy: "browser" }),
        signal: controller.signal,
      }).catch(() => undefined);
    }, delayMs);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [workspaceId, space, delayMs]);

  useEffect(() => {
    const onUnload = () => {
      const snapshot = latest.current ? prepareResearchAutosaveSnapshot(latest.current) : null;
      if (!snapshot) return;
      const body = JSON.stringify({ data: snapshot, lastModifiedBy: "browser" });
      try {
        navigator.sendBeacon?.(`/api/workspaces/${workspaceId}/research-spaces/${snapshot.id}`, new Blob([body], { type: "application/json" }));
      } catch {
        // best effort
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [workspaceId]);
}

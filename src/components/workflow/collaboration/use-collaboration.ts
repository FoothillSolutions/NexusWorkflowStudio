"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { CollabDoc } from "@/lib/collaboration";
import { useCollabStore } from "@/store/collaboration";
import { useWorkflowStore } from "@/store/workflow";

/**
 * Mounts the collaboration layer for the duration of the editor session.
 * - On mount: checks for `?room=` in the URL and auto-joins if present.
 * - On unmount: disconnects the provider.
 * - Registers beforeunload to cleanly disconnect.
 */
export function useCollaboration({ skip }: { skip?: boolean } = {}) {
  const getWorkflowJSON = useWorkflowStore((s) => s.getWorkflowJSON);

  useEffect(() => {
    if (skip) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");

    if (roomId) {
      const doc = CollabDoc.getOrCreate();
      doc.start(roomId, getWorkflowJSON());
    }

    const handleUnload = () => CollabDoc.getInstance()?.destroy();
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      CollabDoc.getInstance()?.destroy();
    };
    // Only run once on mount — getWorkflowJSON is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  return useCollabStore(
    useShallow((s) => ({
      roomId: s.roomId,
      isConnected: s.isConnected,
      isInitializing: s.isInitializing,
      peerCount: s.peerCount,
    }))
  );
}

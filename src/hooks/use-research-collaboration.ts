"use client";

import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { buildResearchRoomId, isResearchDocEmpty, readResearchSpaceFromDoc, writeResearchSpaceToDoc } from "@/lib/research/collaboration";
import { getCollabServerUrl } from "@/lib/collaboration/config";
import type { ResearchSpaceData } from "@/lib/research/types";

export function useResearchCollaboration(
  workspaceId: string,
  space: ResearchSpaceData | null,
  onRemoteSpace: (space: ResearchSpaceData) => void,
) {
  const [status, setStatus] = useState<"disabled" | "connecting" | "connected" | "disconnected">("disabled");
  const roomId = useMemo(() => space ? buildResearchRoomId(workspaceId, space.id) : null, [workspaceId, space]);

  useEffect(() => {
    if (!space || !roomId || typeof window === "undefined") {
      return;
    }
    const doc = new Y.Doc();
    window.setTimeout(() => setStatus("connecting"), 0);
    if (isResearchDocEmpty(doc)) writeResearchSpaceToDoc(doc, space);
    const provider = new HocuspocusProvider({ url: getCollabServerUrl(), name: roomId, document: doc });
    const apply = () => onRemoteSpace(readResearchSpaceFromDoc(doc, space));
    const observer = () => apply();
    doc.on("update", observer);
    provider.on("status", ({ status: next }: { status: string }) => {
      setStatus(next === "connected" ? "connected" : next === "connecting" ? "connecting" : "disconnected");
    });
    return () => {
      doc.off("update", observer);
      provider.destroy();
      doc.destroy();
      window.setTimeout(() => setStatus("disabled"), 0);
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { roomId, status };
}

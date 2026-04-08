"use client";

import { useReactFlow, useStore } from "@xyflow/react";
import { useAwarenessStore } from "@/store/collaboration";
import { useCollabStore } from "@/store/collaboration";
import type { WorkflowNode } from "@/types/workflow";

/**
 * Renders colored selection rings around nodes that remote collaborators
 * currently have selected. Must be rendered within a ReactFlowProvider.
 */
export function CollabSelectionOverlay() {
  const isConnected = useCollabStore((s) => s.isConnected);
  const peers = useAwarenessStore((s) => s.peers);
  const { getNode, getViewport } = useReactFlow<WorkflowNode>();

  // Subscribe to viewport changes so rings stay in sync during pan/zoom
  const transform = useStore((s) => s.transform);

  if (!isConnected || peers.length === 0) return null;

  const viewport = getViewport();

  const rings = peers
    .filter((p) => p.selectedNodeId !== null)
    .flatMap((peer) => {
      const node = getNode(peer.selectedNodeId!);
      if (!node) return [];

      const w = node.measured?.width ?? 180;
      const h = node.measured?.height ?? 60;

      // Convert flow coordinates to screen pixels
      const screenX = node.position.x * viewport.zoom + viewport.x;
      const screenY = node.position.y * viewport.zoom + viewport.y;
      const screenW = w * viewport.zoom;
      const screenH = h * viewport.zoom;

      return [{ peer, screenX, screenY, screenW, screenH }];
    });

  if (rings.length === 0) return null;

  // Suppress unused warning — transform is used only to trigger re-render
  void transform;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {rings.map(({ peer, screenX, screenY, screenW, screenH }) => (
        <div
          key={peer.clientId}
          className="absolute rounded"
          style={{
            left: screenX - 3,
            top: screenY - 3,
            width: screenW + 6,
            height: screenH + 6,
            boxShadow: `0 0 0 2px ${peer.user.color}`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

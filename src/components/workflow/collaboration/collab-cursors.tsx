"use client";

import { useMemo } from "react";
import { useStore } from "@xyflow/react";
import { useAwarenessStore } from "@/store/collaboration";
import { useCollabStore } from "@/store/collaboration";
import { isPeerActive, useIdleTicker } from "./peer-activity";

// Cursor opacity while a peer is idle — still visible so you know where they
// last were, but clearly de-emphasized compared to active peers.
const IDLE_CURSOR_OPACITY = 0.35;

/**
 * Renders remote peer cursors Excalidraw-style. Each cursor is positioned
 * via the React Flow viewport transform so it tracks pan/zoom without
 * having to re-broadcast on scroll. Idle peers are dimmed and marked.
 *
 * Must be rendered inside a ReactFlowProvider.
 */
export function CollabCursors() {
  const isConnected = useCollabStore((s) => s.isConnected);
  const peers = useAwarenessStore((s) => s.peers);

  // Subscribing to transform keeps cursor positions in sync with pan/zoom.
  const [tx, ty, tz] = useStore((s) => s.transform);

  // Re-render periodically so cursors dim without an awareness update.
  useIdleTicker();

  const visible = useMemo(
    () =>
      peers.filter(
        (p) => p.cursor && typeof p.cursor.x === "number" && typeof p.cursor.y === "number",
      ),
    [peers],
  );

  if (!isConnected || visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      aria-hidden="true"
    >
      {visible.map((peer) => {
        const screenX = peer.cursor!.x * tz + tx;
        const screenY = peer.cursor!.y * tz + ty;
        const active = isPeerActive(peer.lastActiveAt);
        return (
          <div
            key={peer.clientId}
            className="absolute"
            style={{
              transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
              transition: "transform 60ms linear, opacity 200ms ease-out",
              willChange: "transform",
              opacity: active ? 1 : IDLE_CURSOR_OPACITY,
            }}
          >
            <CursorSvg color={peer.user.color} />
            <div
              className="absolute left-4 top-4 rounded-md rounded-tl-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight text-white shadow-md whitespace-nowrap"
              style={{ backgroundColor: peer.user.color }}
            >
              {peer.user.name}
              {!active && <span className="ml-1 opacity-75">· idle</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CursorSvg({ color }: { color: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))" }}
    >
      <path
        d="M5 3 L19 12 L12 13 L9 20 Z"
        fill={color}
        stroke="#0b0b0b"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

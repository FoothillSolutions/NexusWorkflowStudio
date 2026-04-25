"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useReactFlow } from "@xyflow/react";
import { CollabDoc } from "@/lib/collaboration";
import { useCollabStore } from "@/store/collaboration";

const BROADCAST_INTERVAL_MS = 40;
// Sub-pixel moves don't matter visually — swallow them to cut idle chatter
// and Hocuspocus awareness bandwidth.
const MIN_FLOW_DELTA = 0.5;

/**
 * Broadcasts the local pointer position (in React Flow coordinates) via
 * Y.js awareness so remote peers can render a live cursor.
 *
 * Listens on `window` in the capture phase — that way we still receive
 * pointer events while React Flow has captured them for a node drag or
 * selection box. A bounding-rect guard discards moves outside the canvas
 * so cursors don't leak from the header / side panels.
 *
 * Must be called inside a ReactFlowProvider.
 */
export function useCursorBroadcast(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean = true,
): void {
  const isConnected = useCollabStore((s) => s.isConnected);
  const { screenToFlowPosition } = useReactFlow();

  const activeRef = useRef(enabled && isConnected);
  const lastSentAtRef = useRef(0);
  const lastSentPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const insideRef = useRef(false);

  useEffect(() => {
    activeRef.current = enabled && isConnected;
    if (!activeRef.current) {
      CollabDoc.getInstance()?.updateAwareness({ cursor: null });
    }
  }, [enabled, isConnected]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const flush = () => {
      timerRef.current = null;
      const pos = pendingRef.current;
      pendingRef.current = null;
      if (!pos) return;

      const prev = lastSentPosRef.current;
      if (
        prev &&
        Math.abs(prev.x - pos.x) < MIN_FLOW_DELTA &&
        Math.abs(prev.y - pos.y) < MIN_FLOW_DELTA
      ) {
        return;
      }

      lastSentPosRef.current = pos;
      CollabDoc.getInstance()?.updateAwareness({ cursor: pos });
      lastSentAtRef.current = performance.now();
    };

    const schedule = () => {
      if (timerRef.current !== null) return;
      const now = performance.now();
      const wait = Math.max(0, BROADCAST_INTERVAL_MS - (now - lastSentAtRef.current));
      timerRef.current = window.setTimeout(flush, wait);
    };

    const clearCursor = () => {
      pendingRef.current = null;
      lastSentPosRef.current = null;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      CollabDoc.getInstance()?.updateAwareness({ cursor: null });
    };

    const handleMove = (event: PointerEvent | MouseEvent) => {
      if (!activeRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;
      const isInside =
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

      if (!isInside) {
        if (insideRef.current) {
          insideRef.current = false;
          clearCursor();
        }
        return;
      }

      insideRef.current = true;
      pendingRef.current = screenToFlowPosition({ x, y });
      schedule();
    };

    const handleBlur = () => {
      insideRef.current = false;
      clearCursor();
    };

    // Capture phase on window — receives events even while React Flow has
    // pointer capture during a drag. `pointermove` covers both mouse and
    // touch / stylus. `mousemove` is a safety net for older browsers.
    window.addEventListener("pointermove", handleMove, { capture: true, passive: true });
    window.addEventListener("mousemove", handleMove, { capture: true, passive: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointermove", handleMove, { capture: true });
      window.removeEventListener("mousemove", handleMove, { capture: true });
      window.removeEventListener("blur", handleBlur);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      CollabDoc.getInstance()?.updateAwareness({ cursor: null });
    };
  }, [containerRef, screenToFlowPosition]);
}

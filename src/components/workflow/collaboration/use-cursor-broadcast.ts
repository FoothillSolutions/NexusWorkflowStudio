"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useReactFlow } from "@xyflow/react";
import { CollabDoc } from "@/lib/collaboration";
import { useCollabStore } from "@/store/collaboration";

const BROADCAST_INTERVAL_MS = 40;

/**
 * Broadcasts the local pointer position (in React Flow coordinates) via
 * Y.js awareness so remote peers can render a live cursor. Positions are
 * throttled to ~25 updates/sec.
 *
 * The listener is scoped to the given canvas container — that keeps
 * off-canvas pointer moves (header, panels, dialogs) out of the broadcast
 * and means remote cursors only appear when peers are actually hovering
 * over the workflow.
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
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    activeRef.current = enabled && isConnected;
    if (!activeRef.current) {
      // Clear stale cursor when disabled so peers don't see a ghost.
      CollabDoc.getInstance()?.updateAwareness({ cursor: null });
    }
  }, [enabled, isConnected]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container) return;

    const flush = () => {
      timerRef.current = null;
      const pos = pendingRef.current;
      pendingRef.current = null;
      if (!pos) return;
      CollabDoc.getInstance()?.updateAwareness({ cursor: pos });
      lastSentAtRef.current = performance.now();
    };

    const schedule = () => {
      if (timerRef.current !== null) return;
      const now = performance.now();
      const wait = Math.max(0, BROADCAST_INTERVAL_MS - (now - lastSentAtRef.current));
      timerRef.current = window.setTimeout(flush, wait);
    };

    const handleMove = (event: MouseEvent) => {
      if (!activeRef.current) return;
      // Ignore moves that originate outside this container (e.g. bubbled
      // from floating children positioned outside the canvas bounds).
      const rect = container.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return;
      }
      pendingRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      schedule();
    };

    const handleLeave = () => {
      if (!activeRef.current) return;
      pendingRef.current = null;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      CollabDoc.getInstance()?.updateAwareness({ cursor: null });
    };

    container.addEventListener("mousemove", handleMove, { passive: true });
    container.addEventListener("mouseleave", handleLeave);
    window.addEventListener("blur", handleLeave);

    return () => {
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("blur", handleLeave);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      CollabDoc.getInstance()?.updateAwareness({ cursor: null });
    };
  }, [containerRef, screenToFlowPosition]);
}

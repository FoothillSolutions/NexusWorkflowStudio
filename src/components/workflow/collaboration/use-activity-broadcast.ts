"use client";

import { useEffect, useRef } from "react";
import { CollabDoc } from "@/lib/collaboration";
import { useCollabStore } from "@/store/collaboration";

// Throttle — don't fire awareness updates more often than this, even if the
// user is hammering the keyboard.
const ACTIVITY_THROTTLE_MS = 5000;

/**
 * Broadcasts a "last active at" timestamp via Y.js awareness whenever the
 * local user interacts with the page. Peers consume `lastActiveAt` to render
 * an active/idle dot — a peer whose timestamp is older than a threshold is
 * shown as idle even though they're still connected.
 *
 * Listens document-wide on capture so any interaction (even inside
 * overlays) counts as activity.
 */
export function useActivityBroadcast(): void {
  const isConnected = useCollabStore((s) => s.isConnected);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isConnected) return;

    // Push an initial timestamp so peers immediately see "active" instead
    // of flickering through "idle" while waiting for the first keystroke.
    CollabDoc.getInstance()?.updateAwareness({ lastActiveAt: Date.now() });
    lastSentRef.current = performance.now();

    const markActive = () => {
      const now = performance.now();
      if (now - lastSentRef.current < ACTIVITY_THROTTLE_MS) return;
      lastSentRef.current = now;
      CollabDoc.getInstance()?.updateAwareness({ lastActiveAt: Date.now() });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") markActive();
    };

    // `capture: true` — fires even when child handlers stop propagation.
    document.addEventListener("pointermove", markActive, { capture: true, passive: true });
    document.addEventListener("pointerdown", markActive, { capture: true, passive: true });
    document.addEventListener("keydown", markActive, { capture: true });
    document.addEventListener("wheel", markActive, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("pointermove", markActive, { capture: true });
      document.removeEventListener("pointerdown", markActive, { capture: true });
      document.removeEventListener("keydown", markActive, { capture: true });
      document.removeEventListener("wheel", markActive, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isConnected]);
}

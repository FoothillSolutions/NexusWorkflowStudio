"use client";

import { useEffect, useState } from "react";

// A peer is considered "active" while their last broadcast activity is
// within this window. Beyond it, they render dimmed (idle).
export const PEER_IDLE_AFTER_MS = 60_000;

export function isPeerActive(lastActiveAt: number | null | undefined): boolean {
  if (typeof lastActiveAt !== "number") return true; // unknown → optimistic
  return Date.now() - lastActiveAt < PEER_IDLE_AFTER_MS;
}

/**
 * Lightweight interval ticker that forces a re-render every `intervalMs`.
 * Lets components flip from "active" → "idle" automatically as time passes,
 * without requiring an awareness update.
 */
export function useIdleTicker(intervalMs: number = 10_000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

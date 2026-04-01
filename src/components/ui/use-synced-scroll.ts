"use client";

import { useEffect, useRef } from "react";

interface UseSyncedScrollOptions {
  enabled: boolean;
  firstElement: HTMLElement | null;
  secondElement: HTMLElement | null;
}

function syncAxis(source: HTMLElement, target: HTMLElement, axis: "scrollTop" | "scrollLeft") {
  const sourceMax = Math.max(
    (axis === "scrollTop" ? source.scrollHeight - source.clientHeight : source.scrollWidth - source.clientWidth),
    0,
  );
  const targetMax = Math.max(
    (axis === "scrollTop" ? target.scrollHeight - target.clientHeight : target.scrollWidth - target.clientWidth),
    0,
  );

  if (sourceMax === 0 || targetMax === 0) {
    target[axis] = 0;
    return;
  }

  target[axis] = (source[axis] / sourceMax) * targetMax;
}

export function useSyncedScroll({
  enabled,
  firstElement,
  secondElement,
}: UseSyncedScrollOptions) {
  const syncingRef = useRef<"first" | "second" | null>(null);
  const releaseFrameRef = useRef<number | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !firstElement || !secondElement) {
      hasInitializedRef.current = false;
      return;
    }

    const releaseLock = (owner: "first" | "second") => {
      if (releaseFrameRef.current !== null) {
        window.cancelAnimationFrame(releaseFrameRef.current);
      }

      releaseFrameRef.current = window.requestAnimationFrame(() => {
        if (syncingRef.current === owner) {
          syncingRef.current = null;
        }
      });
    };

    const sync = (source: HTMLElement, target: HTMLElement, owner: "first" | "second") => {
      if (syncingRef.current && syncingRef.current !== owner) {
        return;
      }

      syncingRef.current = owner;
      syncAxis(source, target, "scrollTop");
      syncAxis(source, target, "scrollLeft");
      releaseLock(owner);
    };

    const handleFirstScroll = () => sync(firstElement, secondElement, "first");
    const handleSecondScroll = () => sync(secondElement, firstElement, "second");

    if (!hasInitializedRef.current) {
      sync(firstElement, secondElement, "first");
      hasInitializedRef.current = true;
    }

    firstElement.addEventListener("scroll", handleFirstScroll, { passive: true });
    secondElement.addEventListener("scroll", handleSecondScroll, { passive: true });

    return () => {
      firstElement.removeEventListener("scroll", handleFirstScroll);
      secondElement.removeEventListener("scroll", handleSecondScroll);
      if (releaseFrameRef.current !== null) {
        window.cancelAnimationFrame(releaseFrameRef.current);
      }
      syncingRef.current = null;
      hasInitializedRef.current = false;
    };
  }, [enabled, firstElement, secondElement]);
}



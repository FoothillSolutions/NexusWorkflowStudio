"use client";
import { useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useSidekickStore } from "@/store/sidekick";
export function useSidekickPosition() {
  const stored = useSidekickStore((s) => s.panelPosition);
  const setStored = useSidekickStore((s) => s.setPanelPosition);
  const [position, setPosition] = useState(stored ?? { x: 0, y: 0 });
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const start = { x: event.clientX, y: event.clientY, px: position.x, py: position.y };
    const move = (e: PointerEvent) => setPosition({ x: start.px + e.clientX - start.x, y: start.py + e.clientY - start.y });
    const up = (e: PointerEvent) => { const next = { x: start.px + e.clientX - start.x, y: start.py + e.clientY - start.y }; setStored(next); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }, [position.x, position.y, setStored]);
  return { style: { right: 24 - position.x, bottom: 24 - position.y }, onPointerDown };
}

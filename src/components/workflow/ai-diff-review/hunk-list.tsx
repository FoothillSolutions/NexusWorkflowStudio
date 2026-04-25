"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Hunk, HunkDecision } from "@/lib/diff/types";
import { HunkItem } from "./hunk-item";

interface HunkListProps {
  hunks: Hunk[];
  decisions: Map<string, HunkDecision>;
  lineDecisions: Map<string, Map<number, boolean>>;
  selectedHunkId: string | null;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onToggleLine: (hunkId: string, lineIndex: number, accepted: boolean) => void;
  onResetLines: (hunkId: string) => void;
}

export function HunkList({
  hunks,
  decisions,
  lineDecisions,
  selectedHunkId,
  onSelect,
  onAccept,
  onReject,
  onToggleLine,
  onResetLines,
}: HunkListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll the selected hunk into view when it changes (keyboard navigation).
  useEffect(() => {
    if (!selectedHunkId) return;
    const root = containerRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLDivElement>(`[data-hunk-id="${selectedHunkId}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedHunkId]);

  if (hunks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-zinc-500 italic">
        No changes detected.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" viewportClassName="pr-2">
      <div ref={containerRef} className="space-y-2.5 py-2">
        {hunks.map((hunk, i) => (
          <div key={hunk.id} data-hunk-id={hunk.id}>
            <HunkItem
              hunk={hunk}
              index={i}
              total={hunks.length}
              selected={hunk.id === selectedHunkId}
              decision={decisions.get(hunk.id) ?? "pending"}
              lineOverrides={lineDecisions.get(hunk.id) ?? new Map()}
              onSelect={() => onSelect(hunk.id)}
              onAccept={() => onAccept(hunk.id)}
              onReject={() => onReject(hunk.id)}
              onToggleLine={(idx, accepted) => onToggleLine(hunk.id, idx, accepted)}
              onResetLines={() => onResetLines(hunk.id)}
            />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

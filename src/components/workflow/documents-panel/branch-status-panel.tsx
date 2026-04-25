"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PackRecord } from "@/lib/library-store/types";

interface BranchStatusPanelProps {
  pack: PackRecord;
  hasPendingMerge: boolean;
  onMergeBase: () => void;
  onResolveConflicts?: () => void;
}

export function BranchStatusPanel({ pack, hasPendingMerge, onMergeBase, onResolveConflicts }: BranchStatusPanelProps) {
  const isFork = pack.basePackId !== null;
  if (!isFork) return null;
  return (
    <div className="rounded-md border border-violet-700/40 bg-violet-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge className="bg-violet-700 text-white">forked</Badge>
        {pack.basePackId && (
          <span className="text-xs text-zinc-400">base: {pack.basePackId.slice(0, 8)}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onMergeBase}>Merge latest base</Button>
        {hasPendingMerge && onResolveConflicts && (
          <Button size="sm" variant="destructive" onClick={onResolveConflicts}>Resolve conflicts</Button>
        )}
      </div>
    </div>
  );
}

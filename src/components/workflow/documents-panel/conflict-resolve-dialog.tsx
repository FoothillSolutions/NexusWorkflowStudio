"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConflictRecord } from "@/lib/library-store/types";

interface ConflictResolveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictRecord[];
  onResolve: (resolved: Record<string, string>) => void;
}

export function ConflictResolveDialog({ open, onOpenChange, conflicts, onResolve }: ConflictResolveDialogProps) {
  const initial = useMemo(() => {
    const init: Record<string, string> = {};
    for (const c of conflicts) init[c.docId] = c.branchContent ?? "";
    return init;
  }, [conflicts]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const resolutions = { ...initial, ...overrides };
  const setResolutions = (next: Record<string, string>) => setOverrides(next);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Resolve Merge Conflicts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="rounded-md border border-zinc-800 p-3">
              <div className="text-xs font-mono text-zinc-400 mb-2">doc: {conflict.docId}</div>
              <div className="grid grid-cols-3 gap-2 mb-2 text-[11px]">
                <div>
                  <div className="text-zinc-500 uppercase mb-1">Ancestor</div>
                  <pre className="bg-zinc-950 p-2 rounded text-zinc-400 max-h-32 overflow-auto whitespace-pre-wrap">{conflict.ancestorContent}</pre>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase mb-1">Base</div>
                  <pre className="bg-zinc-950 p-2 rounded text-zinc-400 max-h-32 overflow-auto whitespace-pre-wrap">{conflict.baseContent}</pre>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase mb-1">Branch</div>
                  <pre className="bg-zinc-950 p-2 rounded text-zinc-400 max-h-32 overflow-auto whitespace-pre-wrap">{conflict.branchContent}</pre>
                </div>
              </div>
              <Textarea
                value={resolutions[conflict.docId] ?? ""}
                onChange={(e) => setResolutions({ ...resolutions, [conflict.docId]: e.target.value })}
                rows={6}
                className="font-mono text-xs"
                placeholder="Final merged content"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onResolve(resolutions); onOpenChange(false); }}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

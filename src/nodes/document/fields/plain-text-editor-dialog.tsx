"use client";

import { useCallback, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PlainTextEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (value: string) => void;
  fileExtension: string;
}

export function PlainTextEditorDialog({
  open,
  onOpenChange,
  value,
  onSave,
  fileExtension,
}: PlainTextEditorDialogProps) {
  const [draft, setDraft] = useState(value);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraft(value);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, value],
  );

  const handleSave = useCallback(() => {
    onSave(draft);
    onOpenChange(false);
  }, [draft, onOpenChange, onSave]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="h-[80vh]! max-h-[80vh]! w-[80vw]! max-w-[80vw]! flex flex-col gap-0 rounded-2xl border-zinc-700/50 bg-zinc-900 p-0">
        <DialogHeader className="shrink-0 border-b border-zinc-700/50 px-5 py-4">
          <DialogTitle className="text-sm font-medium text-zinc-100">
            Edit {fileExtension.toUpperCase()} Content
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 p-4">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Enter ${fileExtension.toUpperCase()} content...`}
            className="h-full w-full resize-none rounded-xl border-zinc-700/60 bg-zinc-800/60 font-mono text-sm focus-visible:ring-zinc-600"
          />
        </div>
        <DialogFooter className="shrink-0 border-t border-zinc-700/50 px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5 rounded-xl">
            <Check size={14} />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



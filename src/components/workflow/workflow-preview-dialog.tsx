"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface WorkflowPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markdown: string;
  title?: string;
  onDownload?: () => void;
}

export default function WorkflowPreviewDialog({
  open,
  onOpenChange,
  markdown,
  title = "Workflow Preview",
  onDownload,
}: WorkflowPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-3xl w-full max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-zinc-100 text-base flex-1">{title}</DialogTitle>
            {onDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownload}
                className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-4 pb-4 pt-3">
          <textarea
            readOnly
            value={markdown}
            className="w-full h-full min-h-[500px] resize-none bg-zinc-950 text-zinc-200 text-xs font-mono leading-relaxed border border-zinc-700 rounded-lg p-4 outline-none select-all"
            spellCheck={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

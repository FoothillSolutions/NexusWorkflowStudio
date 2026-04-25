"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<void>;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      await onImport(file);
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import .nexus archive</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Select a .nexus archive or Agent Skills zip to import into the current scope.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".nexus,.zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-700 file:px-3 file:py-1.5 file:text-white"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

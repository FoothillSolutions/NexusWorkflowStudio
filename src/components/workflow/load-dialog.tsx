"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useWorkflowStore } from "@/store/workflow-store";
import {
  importWorkflow,
  loadFromLocalStorage,
  hasSavedWorkflow,
} from "@/lib/persistence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, HardDrive } from "lucide-react";
import { toast } from "sonner";

interface LoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LoadDialog({ open, onOpenChange }: LoadDialogProps) {
  const { loadWorkflow } = useWorkflowStore();
  const [hasSaved, setHasSaved] = useState(false);

  // Check for saved workflow when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setHasSaved(hasSavedWorkflow());
    }
    onOpenChange(newOpen);
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      try {
        const file = acceptedFiles[0];
        const data = await importWorkflow(file);
        loadWorkflow(data);
        toast.success("Workflow imported successfully");
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to import workflow"
        );
      }
    },
    [loadWorkflow, onOpenChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/json": [".json"],
    },
    maxFiles: 1,
  });

  const handleLoadLastSaved = () => {
    const data = loadFromLocalStorage();
    if (data) {
      loadWorkflow(data);
      toast.success("Last saved workflow loaded");
      onOpenChange(false);
    } else {
      toast.error("No saved workflow found or invalid data");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Load Workflow</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Choose how you want to load a workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${
                isDragActive
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-10 w-10 text-zinc-500 mb-3" />
            <p className="text-sm font-medium text-zinc-300">
              {isDragActive
                ? "Drop the file here"
                : "Drag & drop a JSON file here, or click to select"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Accepts .json files</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500">Or</span>
            </div>
          </div>

          <Button
            onClick={handleLoadLastSaved}
            disabled={!hasSaved}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
          >
            <HardDrive className="mr-2 h-4 w-4" />
            Load Last Saved Workflow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

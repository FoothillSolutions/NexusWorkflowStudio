"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
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
import {
  BG_SURFACE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  TEXT_SUBTLE,
  TEXT_SECONDARY,
  BG_ELEVATED,
  BORDER_MUTED,
} from "@/lib/theme";

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
        loadWorkflow(data, { savedToLibrary: false });
        useSavedWorkflowsStore.getState().clearActiveId();
        window.dispatchEvent(new CustomEvent("nexus:fit-view"));
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
      loadWorkflow(data, { savedToLibrary: false });
      useSavedWorkflowsStore.getState().clearActiveId();
      window.dispatchEvent(new CustomEvent("nexus:fit-view"));
      toast.success("Last saved workflow loaded");
      onOpenChange(false);
    } else {
      toast.error("No saved workflow found or invalid data");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`sm:max-w-md ${BG_SURFACE} ${BORDER_DEFAULT} ${TEXT_PRIMARY}`}>
        <DialogHeader>
          <DialogTitle>Load Workflow</DialogTitle>
          <DialogDescription className={TEXT_MUTED}>
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
                  : `${BORDER_MUTED} hover:border-zinc-500 hover:${BG_ELEVATED}/50`
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className={`mx-auto h-10 w-10 ${TEXT_SUBTLE} mb-3`} />
            <p className={`text-sm font-medium ${TEXT_SECONDARY}`}>
              {isDragActive
                ? "Drop the file here"
                : "Drag & drop a JSON file here, or click to select"}
            </p>
            <p className={`text-xs ${TEXT_SUBTLE} mt-1`}>Accepts .json files</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className={`w-full border-t ${BORDER_DEFAULT}`} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className={`${BG_SURFACE} px-2 ${TEXT_SUBTLE}`}>Or</span>
            </div>
          </div>

          <Button
            onClick={handleLoadLastSaved}
            disabled={!hasSaved}
            className={`w-full ${BG_ELEVATED} hover:bg-zinc-700 ${TEXT_PRIMARY}`}
          >
            <HardDrive className="mr-2 h-4 w-4" />
            Load Last Saved Workflow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

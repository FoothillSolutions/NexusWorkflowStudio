"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useWorkflowStore } from "@/store/workflow";
import { importWorkflow } from "@/lib/persistence";
import { useSavedWorkflowsStore } from "@/store/library";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";
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

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { loadWorkflow } = useWorkflowStore();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-md ${BG_SURFACE} ${BORDER_DEFAULT} ${TEXT_PRIMARY}`}>
        <DialogHeader>
          <DialogTitle>Import Workflow</DialogTitle>
          <DialogDescription className={TEXT_MUTED}>
            Import a workflow from a JSON file.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import ImportDialog from "../import-dialog";
import GeneratedExportDialog from "../generated-export-dialog";
import UnsavedChangesDialog from "../unsaved-changes-dialog";
import WorkflowPreviewDialog from "../workflow-preview-dialog";
import {
  getGenerationTarget,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import type { WorkflowJSON } from "@/types/workflow";

interface HeaderDialogsProps {
  importDialogOpen: boolean;
  onImportDialogOpenChange: (open: boolean) => void;
  previewOpen: boolean;
  onPreviewOpenChange: (open: boolean) => void;
  previewMarkdown: string;
  workflowName: string;
  generateDialogOpen: boolean;
  onGenerateDialogOpenChange: (open: boolean) => void;
  generateTarget: GenerationTargetId;
  onGenerateTargetChange: (target: GenerationTargetId) => void;
  getWorkflow: () => WorkflowJSON;
  onPreviewDownload: () => void;
  confirmNewOpen: boolean;
  onConfirmNewOpenChange: (open: boolean) => void;
  onConfirmNewWorkflow: () => void;
}

export function HeaderDialogs({
  importDialogOpen,
  onImportDialogOpenChange,
  previewOpen,
  onPreviewOpenChange,
  previewMarkdown,
  workflowName,
  generateDialogOpen,
  onGenerateDialogOpenChange,
  generateTarget,
  onGenerateTargetChange,
  getWorkflow,
  onPreviewDownload,
  confirmNewOpen,
  onConfirmNewOpenChange,
  onConfirmNewWorkflow,
}: HeaderDialogsProps) {
  return (
    <>
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={onImportDialogOpenChange}
      />
      <WorkflowPreviewDialog
        open={previewOpen}
        onOpenChange={onPreviewOpenChange}
        markdown={previewMarkdown}
        title={`Preview — ${workflowName} · ${getGenerationTarget(generateTarget).label}`}
        onDownload={onPreviewDownload}
        downloadLabel="Export…"
      />
      <GeneratedExportDialog
        open={generateDialogOpen}
        onOpenChange={onGenerateDialogOpenChange}
        target={generateTarget}
        onTargetChange={onGenerateTargetChange}
        getWorkflow={getWorkflow}
      />
      <UnsavedChangesDialog
        open={confirmNewOpen}
        onOpenChange={onConfirmNewOpenChange}
        title="Start a new workflow?"
        description="Your current workflow has unsaved work. Starting a new workflow will replace it."
        confirmLabel="Start New Workflow"
        onConfirm={onConfirmNewWorkflow}
      />
    </>
  );
}


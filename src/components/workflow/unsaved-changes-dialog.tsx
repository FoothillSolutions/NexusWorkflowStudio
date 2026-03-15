"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export default function UnsavedChangesDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: UnsavedChangesDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="warning"
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
    />
  );
}


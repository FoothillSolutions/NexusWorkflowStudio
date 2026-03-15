"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function DeleteDialog() {
  const deleteTarget = useWorkflowStore((s) => s.deleteTarget);
  const setDeleteTarget = useWorkflowStore((s) => s.setDeleteTarget);
  const confirmDelete = useWorkflowStore((s) => s.confirmDelete);

  // Only compute selectedCount when dialog is actually open for a selection delete
  const selectedCount = useWorkflowStore((s) =>
    s.deleteTarget?.type === "selection"
      ? s.deleteTarget.count ?? (
        s.deleteTarget.scope === "subworkflow"
          ? s.subWorkflowNodes.filter((n) => n.selected && n.data?.type !== "start").length
          : s.nodes.filter((n) => n.selected && n.data?.type !== "start").length
      )
      : 0
  );
  const deleteRef = useRef<HTMLButtonElement>(null);

  const targetLabel = deleteTarget?.type === "edge"
    ? "connection"
    : deleteTarget?.type === "selection"
      ? `${selectedCount} selected node${selectedCount !== 1 ? "s" : ""}`
      : "node";

  const handleConfirm = useCallback(() => {
    confirmDelete();
  }, [confirmDelete]);

  // Auto-focus the Delete button when the dialog opens
  useEffect(() => {
    if (deleteTarget !== null) {
      // Small timeout so Radix finishes mounting/animating before we steal focus
      const timer = setTimeout(() => deleteRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [deleteTarget]);

  // Allow Delete / Backspace key to confirm while the dialog is open
  useEffect(() => {
    if (deleteTarget === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [deleteTarget, handleConfirm]);

  return (
    <ConfirmDialog
      open={deleteTarget !== null}
      onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}
      tone="danger"
      title={`Delete ${deleteTarget?.type === "selection" ? targetLabel : `this ${targetLabel}`}?`}
      description="This action cannot be undone."
      confirmLabel="Delete"
      onConfirm={handleConfirm}
      confirmRef={deleteRef}
      onOpenAutoFocus={(e) => {
        // Prevent Radix from focusing Cancel; we focus Delete instead
        e.preventDefault();
        deleteRef.current?.focus();
      }}
    />
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BG_SURFACE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
  BG_ELEVATED,
  BORDER_MUTED,
  TEXT_SECONDARY,
} from "@/lib/theme";

export default function DeleteDialog() {
  const { deleteTarget, setDeleteTarget, confirmDelete, nodes } = useWorkflowStore();
  const deleteRef = useRef<HTMLButtonElement>(null);

  const selectedCount = deleteTarget?.type === "selection"
    ? nodes.filter((n) => n.selected && n.data?.type !== "start").length
    : 0;

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
    <AlertDialog
      open={deleteTarget !== null}
      onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}
    >
      <AlertDialogContent
        className={`${BG_SURFACE} ${BORDER_DEFAULT} ${TEXT_PRIMARY}`}
        onOpenAutoFocus={(e) => {
          // Prevent Radix from focusing Cancel; we focus Delete instead
          e.preventDefault();
          deleteRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {deleteTarget?.type === "selection" ? targetLabel : `this ${targetLabel}`}?
          </AlertDialogTitle>
          <AlertDialogDescription className={TEXT_MUTED}>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className={`${BG_ELEVATED} ${TEXT_SECONDARY} ${BORDER_MUTED} hover:bg-zinc-700 hover:text-zinc-100`}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            ref={deleteRef}
            variant="destructive"
            onClick={handleConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

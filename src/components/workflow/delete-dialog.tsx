"use client";

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
  const { deleteTarget, setDeleteTarget, confirmDelete } = useWorkflowStore();

  return (
    <AlertDialog
      open={deleteTarget !== null}
      onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}
    >
      <AlertDialogContent className={`${BG_SURFACE} ${BORDER_DEFAULT} ${TEXT_PRIMARY}`}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete this {deleteTarget?.type === "edge" ? "connection" : "node"}?
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
            variant="destructive"
            onClick={() => confirmDelete()}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

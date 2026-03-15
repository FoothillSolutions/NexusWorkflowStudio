"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_META: Record<ConfirmDialogTone, {
  icon: LucideIcon;
  mediaClassName: string;
  confirmVariant: React.ComponentProps<typeof AlertDialogAction>["variant"];
}> = {
  danger: {
    icon: Trash2,
    mediaClassName: "border border-red-500/20 bg-red-500/10 text-red-300",
    confirmVariant: "destructive",
  },
  warning: {
    icon: AlertTriangle,
    mediaClassName: "border border-amber-500/20 bg-amber-500/10 text-amber-300",
    confirmVariant: "destructive",
  },
  neutral: {
    icon: AlertTriangle,
    mediaClassName: "border border-zinc-700/70 bg-zinc-800/70 text-zinc-300",
    confirmVariant: "default",
  },
};

export type ConfirmDialogTone = "danger" | "warning" | "neutral";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel?: React.ReactNode;
  onConfirm: () => void;
  tone?: ConfirmDialogTone;
  icon?: React.ReactNode;
  confirmVariant?: React.ComponentProps<typeof AlertDialogAction>["variant"];
  contentClassName?: string;
  descriptionClassName?: string;
  cancelClassName?: string;
  confirmClassName?: string;
  confirmRef?: React.Ref<HTMLButtonElement>;
  onOpenAutoFocus?: React.ComponentProps<typeof AlertDialogContent>["onOpenAutoFocus"];
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  tone = "warning",
  icon,
  confirmVariant,
  contentClassName,
  descriptionClassName,
  cancelClassName,
  confirmClassName,
  confirmRef,
  onOpenAutoFocus,
}: ConfirmDialogProps) {
  const toneMeta = TONE_META[tone];
  const Icon = toneMeta.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn("border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl shadow-black/50", contentClassName)} onOpenAutoFocus={onOpenAutoFocus}>
        <AlertDialogHeader className="grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto] items-start gap-x-3 gap-y-1 place-items-start text-left">
          <AlertDialogMedia className={cn("row-span-2 mb-0 size-12 rounded-xl", toneMeta.mediaClassName)}>
            {icon ?? <Icon className="h-6 w-6" />}
          </AlertDialogMedia>
          <AlertDialogTitle className="col-start-2 row-start-1 self-end">{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className={cn("col-start-2 row-start-2 text-zinc-400", descriptionClassName)}>
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className={cn(
              "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100",
              cancelClassName,
            )}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            ref={confirmRef}
            variant={confirmVariant ?? toneMeta.confirmVariant}
            onClick={onConfirm}
            className={confirmClassName}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


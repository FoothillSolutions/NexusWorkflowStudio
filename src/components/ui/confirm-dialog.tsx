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
  glowClassName: string;
  badgeClassName: string;
  badgeLabel: string;
  confirmClassName: string;
  confirmVariant: React.ComponentProps<typeof AlertDialogAction>["variant"];
}> = {
  danger: {
    icon: Trash2,
    mediaClassName: "border border-red-500/20 bg-red-500/10 text-red-300 shadow-lg shadow-red-950/20",
    glowClassName: "from-red-500/12 bg-red-500/10",
    badgeClassName: "border border-red-500/20 bg-red-500/10 text-red-300",
    badgeLabel: "Destructive action",
    confirmClassName: "rounded-xl bg-red-500 text-white shadow-[0_12px_28px_rgba(127,29,29,0.32)] hover:bg-red-400",
    confirmVariant: "destructive",
  },
  warning: {
    icon: AlertTriangle,
    mediaClassName: "border border-amber-500/20 bg-amber-500/10 text-amber-300 shadow-lg shadow-amber-950/20",
    glowClassName: "from-amber-500/12 bg-amber-500/10",
    badgeClassName: "border border-amber-500/20 bg-amber-500/10 text-amber-300",
    badgeLabel: "Needs confirmation",
    confirmClassName: "rounded-xl bg-amber-500 text-zinc-950 shadow-[0_12px_28px_rgba(120,53,15,0.28)] hover:bg-amber-400",
    confirmVariant: "destructive",
  },
  neutral: {
    icon: AlertTriangle,
    mediaClassName: "border border-zinc-700/70 bg-zinc-800/70 text-zinc-300 shadow-lg shadow-black/20",
    glowClassName: "from-zinc-500/10 bg-zinc-500/10",
    badgeClassName: "border border-zinc-700/70 bg-zinc-900/70 text-zinc-300",
    badgeLabel: "Confirmation required",
    confirmClassName: "rounded-xl bg-zinc-100 text-zinc-900 shadow-[0_12px_28px_rgba(0,0,0,0.24)] hover:bg-white",
    confirmVariant: "default",
  },
};

const DIALOG_SHELL_CLASS =
  "gap-0 overflow-hidden rounded-[28px] border border-zinc-700/60 bg-zinc-900 p-0 text-zinc-100 shadow-2xl shadow-black/50 sm:max-w-md";

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
      <AlertDialogContent
        className={cn(DIALOG_SHELL_CLASS, contentClassName)}
        onOpenAutoFocus={onOpenAutoFocus}
      >
        <div className="relative overflow-hidden px-6 pt-6 pb-4.5">
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b via-transparent to-transparent",
              toneMeta.glowClassName,
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute left-6 top-3 h-24 w-24 rounded-full blur-3xl",
              toneMeta.glowClassName,
            )}
          />

          <AlertDialogHeader className="relative grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto_auto] items-start gap-x-4 gap-y-2 place-items-start text-left sm:grid-cols-[auto_minmax(0,1fr)]">
            <AlertDialogMedia className={cn("row-span-3 mb-0 size-12 rounded-2xl", toneMeta.mediaClassName)}>
              {icon ?? <Icon className="h-5 w-5" />}
            </AlertDialogMedia>
            <div className="col-start-2 row-start-1 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className={cn("rounded-full px-2.5 py-1", toneMeta.badgeClassName)}>
                {toneMeta.badgeLabel}
              </span>
            </div>
            <AlertDialogTitle className="col-start-2 row-start-2 text-xl leading-tight font-semibold tracking-tight text-zinc-100">
              {title}
            </AlertDialogTitle>
            {description ? (
              <AlertDialogDescription className={cn("col-start-2 row-start-3 max-w-lg text-sm leading-6 text-zinc-400", descriptionClassName)}>
                {description}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter className="px-6 pt-1 pb-5 sm:items-center sm:justify-end">
          <AlertDialogCancel
            className={cn(
              "rounded-xl border-zinc-700/80 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100",
              cancelClassName,
            )}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            ref={confirmRef}
            variant={confirmVariant ?? toneMeta.confirmVariant}
            onClick={onConfirm}
            className={cn(toneMeta.confirmClassName, confirmClassName)}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CHANGELOG, CURRENT_VERSION } from "@/lib/changelog";
import type { ChangeCategory, ChangelogEntry } from "@/lib/changelog";
import {
  Sparkles,
  Wrench,
  Bug,
  Trash2,
  AlertTriangle,
  History,
  X,
} from "lucide-react";

// ── Category styling map ────────────────────────────────────────────────────
const CATEGORY_META: Record<
  ChangeCategory,
  { icon: React.ElementType; bg: string; text: string; border: string; dot: string }
> = {
  New:      { icon: Sparkles,      bg: "bg-emerald-950/40", text: "text-emerald-400", border: "border-emerald-800/40", dot: "bg-emerald-400" },
  Improved: { icon: Wrench,        bg: "bg-blue-950/40",    text: "text-blue-400",    border: "border-blue-800/40",    dot: "bg-blue-400"    },
  Fixed:    { icon: Bug,           bg: "bg-amber-950/40",   text: "text-amber-400",   border: "border-amber-800/40",   dot: "bg-amber-400"   },
  Removed:  { icon: Trash2,        bg: "bg-red-950/40",     text: "text-red-400",     border: "border-red-800/40",     dot: "bg-red-400"     },
  Breaking: { icon: AlertTriangle, bg: "bg-rose-950/40",    text: "text-rose-400",    border: "border-rose-800/40",    dot: "bg-rose-400"    },
};

// ── Reusable entry renderer ─────────────────────────────────────────────────
function ChangelogEntryView({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="space-y-4">
      {entry.categories.map(({ category, items }) => {
        const meta = CATEGORY_META[category];
        const Icon = meta.icon;
        return (
          <div
            key={category}
            className={`space-y-3 rounded-xl border p-4 ${meta.bg} ${meta.border}`}
          >
            {/* Category heading */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${meta.bg} ${meta.text} ${meta.border}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {category}
              </div>
            </div>

            {/* Items */}
            <ul className="space-y-2 pl-1">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-200">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface WhatsNewDialogProps {
  open: boolean;
  onDismiss: () => void;
}

/**
 * "What's New" dialog — auto-shows latest version on update.
 * Also supports opening from the header "Patch Notes" menu to
 * browse the full changelog history.
 */
export default function WhatsNewDialog({ open, onDismiss }: WhatsNewDialogProps) {
  // "latest" = auto-popup showing only newest entry
  // "full"   = manually opened from header, showing all versions
  const [mode, setMode] = useState<"latest" | "full">("latest");

  // Listen for the header "Patch Notes" event
  useEffect(() => {
    const handler = () => setMode("full");
    window.addEventListener("nexus:open-patch-notes", handler);
    return () => window.removeEventListener("nexus:open-patch-notes", handler);
  }, []);

  // When the dialog closes, reset mode back to "latest" for next auto-popup
  const handleClose = () => {
    onDismiss();
    // Small delay so the dialog closes before resetting mode
    setTimeout(() => setMode("latest"), 200);
  };

  const latestEntry = CHANGELOG[0];
  if (!latestEntry) return null;

  const isFullMode = mode === "full";
  const title = isFullMode ? "Patch Notes" : "What\u2019s New";
  const description = isFullMode
    ? `Full changelog \u00b7 ${CHANGELOG.length} ${CHANGELOG.length === 1 ? "release" : "releases"}`
    : `Version ${CURRENT_VERSION} \u00b7 ${latestEntry.date}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        style={{ display: "flex", flexDirection: "column" }}
        className="bg-zinc-900 border-zinc-700/60 sm:max-w-2xl max-h-[85vh] gap-0 p-0 overflow-hidden shadow-2xl shadow-black/50"
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-start gap-3">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-xl border ${
                isFullMode
                  ? "bg-blue-600/20 border-blue-500/30"
                  : "bg-violet-600/20 border-violet-500/30"
              }`}
            >
              {isFullMode ? (
                <History className="h-5 w-5 text-blue-400" />
              ) : (
                <Sparkles className="h-5 w-5 text-violet-400" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-zinc-100">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-400 mt-0.5">
                {description}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto shrink-0 px-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-5">
            {isFullMode ? (
              // ── Full changelog ──
              CHANGELOG.map((entry, idx) => (
                <div key={entry.version} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
                  {/* Version header */}
                  <div className="mb-4 flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-semibold text-zinc-100 tracking-tight">
                      v{entry.version}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {entry.date}
                    </span>
                    {idx === 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-600/30 text-violet-300 border border-violet-500/30">
                        Latest
                      </span>
                    )}
                  </div>
                  <ChangelogEntryView entry={entry} />
                  {idx < CHANGELOG.length - 1 && (
                    <Separator className="mt-6 mb-1 bg-zinc-800/80" />
                  )}
                </div>
              ))
            ) : (
              // ── Latest only ──
              <ChangelogEntryView entry={latestEntry} />
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {!isFullMode && (
          <DialogFooter className="px-6 py-4 border-t border-zinc-800 shrink-0 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setMode("full")}
              className="text-zinc-400 hover:text-zinc-100 text-sm gap-1.5"
            >
              <History className="h-4 w-4" />
              View all patch notes
            </Button>
            <Button
              onClick={handleClose}
              className="bg-violet-600 hover:bg-violet-500 text-white px-8 ml-auto"
            >
              Got it!
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}


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
import { Badge } from "@/components/ui/badge";
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
  CalendarDays,
  Layers3,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const DIALOG_SHELL_CLASS = "flex h-[85vh] min-h-0 max-h-[85vh] flex-col gap-0 overflow-hidden rounded-[28px] border border-zinc-700/60 bg-zinc-900 p-0 text-zinc-100 shadow-2xl shadow-black/50 sm:max-w-3xl";
const CARD_CLASS = "rounded-2xl border border-zinc-800/80 bg-zinc-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

function countItems(entry: ChangelogEntry) {
  return entry.categories.reduce((total, category) => total + category.items.length, 0);
}

function MetaPill({
  icon: Icon,
  children,
  className,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 bg-zinc-950/70 px-3 py-1 text-[11px] font-medium text-zinc-300",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 text-zinc-500" />
      <span>{children}</span>
    </div>
  );
}

// ── Reusable entry renderer ─────────────────────────────────────────────────
function ChangelogEntryView({ entry, highlightLatest = false }: { entry: ChangelogEntry; highlightLatest?: boolean }) {
  const totalItems = countItems(entry);

  return (
    <div className={`${CARD_CLASS} overflow-hidden`}>
      <div className="relative overflow-hidden border-b border-zinc-800/80 px-5 py-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-violet-500/10 via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-zinc-100">
                v{entry.version}
              </h3>
              {highlightLatest && (
                <Badge className="border border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/10">
                  Latest release
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MetaPill icon={CalendarDays}>{entry.date}</MetaPill>
              <MetaPill icon={Layers3}>{entry.categories.length} categories</MetaPill>
              <MetaPill icon={Sparkles}>{totalItems} updates</MetaPill>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
      {entry.categories.map(({ category, items }) => {
        const meta = CATEGORY_META[category];
        const Icon = meta.icon;
        return (
          <div
            key={category}
            className={cn(
              "space-y-3 rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
              meta.bg,
              meta.border,
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  meta.bg,
                  meta.text,
                  meta.border,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {category}
              </div>
            </div>

            <ul className="space-y-2.5 pl-0.5">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-zinc-200">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`}
                  />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      </div>
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
  const visibleEntries = isFullMode ? CHANGELOG : [latestEntry];
  const totalReleases = CHANGELOG.length;
  const totalLatestItems = countItems(latestEntry);
  const title = isFullMode ? "Patch Notes" : "What\u2019s New";
  const description = isFullMode
    ? `Full changelog \u00b7 ${CHANGELOG.length} ${CHANGELOG.length === 1 ? "release" : "releases"}`
    : `Version ${CURRENT_VERSION} \u00b7 ${latestEntry.date}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className={DIALOG_SHELL_CLASS}
      >
        <div className="relative min-h-37 overflow-hidden border-b border-zinc-800 bg-zinc-950/40 px-6 pt-6 pb-5">
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b via-transparent to-transparent",
              isFullMode ? "from-blue-500/12" : "from-violet-500/12",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute left-6 top-3 h-24 w-24 rounded-full blur-3xl",
              isFullMode ? "bg-blue-500/10" : "bg-violet-500/10",
            )}
          />

          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4 z-10 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>

          <div className="relative flex h-full flex-col justify-between gap-4 pr-12">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-lg",
                  isFullMode
                    ? "border-blue-500/25 bg-blue-500/10 shadow-blue-950/20"
                    : "border-violet-500/25 bg-violet-500/10 shadow-violet-950/20",
                )}
              >
                {isFullMode ? (
                  <History className="h-6 w-6 text-blue-400" />
                ) : (
                  <Sparkles className="h-6 w-6 text-violet-400" />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <DialogHeader className="min-w-0 gap-2 text-left">
                  <DialogTitle className="pr-2 text-xl leading-tight font-semibold tracking-tight text-zinc-100 sm:text-[1.35rem]">
                    {title}
                  </DialogTitle>
                  <DialogDescription className="max-w-2xl pr-1 text-sm leading-6 text-zinc-400">
                    {description}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isFullMode ? (
                <>
                  <Badge className="border border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
                    {totalReleases} releases
                  </Badge>
                  <Badge variant="outline" className="border-zinc-700 bg-zinc-900/80 text-zinc-300">
                    Latest v{CURRENT_VERSION}
                  </Badge>
                </>
              ) : (
                <>
                  <Badge className="border border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/10">
                    v{CURRENT_VERSION}
                  </Badge>
                  <Badge variant="outline" className="border-zinc-700 bg-zinc-900/80 text-zinc-300">
                    {latestEntry.categories.length} categories
                  </Badge>
                  <Badge variant="outline" className="border-zinc-700 bg-zinc-900/80 text-zinc-300">
                    {totalLatestItems} highlights
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full" viewportClassName="h-full overscroll-contain">
            <div className="space-y-5 px-6 py-5">
              {!isFullMode && (
                <div className={`${CARD_CLASS} px-4 py-3`}>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                    <span className="font-medium text-zinc-100">Highlights in this release</span>
                    <ChevronRight className="h-4 w-4 text-zinc-600" />
                    <span className="text-zinc-400">A polished summary of the latest updates in Nexus Workflow Studio.</span>
                  </div>
                </div>
              )}

              {visibleEntries.map((entry, idx) => (
                <div key={entry.version} className="space-y-5">
                  <ChangelogEntryView entry={entry} highlightLatest={idx === 0} />
                  {isFullMode && idx < visibleEntries.length - 1 && (
                    <Separator className="bg-zinc-800/80" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {!isFullMode && (
          <DialogFooter className="border-t border-zinc-800 px-6 py-4 shrink-0 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setMode("full")}
              className="gap-1.5 border border-zinc-800 bg-zinc-950/40 text-sm text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
            >
              <History className="h-4 w-4" />
              View all patch notes
            </Button>
            <Button
              onClick={handleClose}
              className="ml-auto bg-violet-600 px-8 text-white shadow-sm shadow-violet-950/30 hover:bg-violet-500"
            >
              Got it!
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}


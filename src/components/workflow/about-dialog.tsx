"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CURRENT_VERSION } from "@/lib/changelog";
import {
  ExternalLink,
  Heart,
  Scale,
  X,
} from "lucide-react";

/* ── GitHub SVG icon (avoids deprecated lucide export) ───────────────────── */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}


/* ── Links ───────────────────────────────────────────────────────────────── */
const REPO_URL = "https://github.com/FoothillSolutions/NexusWorkflowStudio";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden border-zinc-700/60 bg-zinc-900 p-0 text-zinc-100 shadow-2xl shadow-black/50 sm:max-w-lg"
      >
        <div className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950/40 px-6 pt-6 pb-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-emerald-500/10 via-transparent to-transparent" />
          <div className="pointer-events-none absolute left-6 top-2 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-black text-white shadow-sm shadow-black/40">
              <span className="text-lg font-semibold tracking-tight">N</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
                  <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-100">
                    Nexus Workflow Studio
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-zinc-400">
                    An open-source platform for designing and exporting AI agentic
                    workflows.
                  </DialogDescription>
                </DialogHeader>

                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mr-2 -mt-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogClose>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
                  v{CURRENT_VERSION}
                </Badge>
                <Badge variant="outline" className="border-zinc-700 bg-zinc-900/80 text-zinc-300">
                  Visual orchestration
                </Badge>
                <Badge variant="outline" className="border-zinc-700 bg-zinc-900/80 text-zinc-300">
                  Portable output
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-6 text-zinc-400">
            Nexus Workflow Studio provides a structured visual environment for
            designing, orchestrating, and exporting AI agent workflows. Build
            complex automation on an intuitive canvas and generate clean,
            portable artifacts that remain transparent, maintainable, and fully
            under your control.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                Workflow design
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Compose agent behavior visually with a canvas built for clarity,
                iteration, and scale.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                Artifact ownership
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Export implementation-ready workflow artifacts that remain easy
                to inspect, adapt, and own.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 px-6 py-4">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-950"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors group-hover:border-zinc-700 group-hover:text-zinc-200">
              <GitHubIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-200 transition-colors group-hover:text-zinc-100">
                GitHub Repository
              </div>
              <div className="mt-0.5 text-xs leading-5 text-zinc-500">
                Follow project development, review the source, and explore the
                latest updates on GitHub.
              </div>
              <div className="mt-1 text-[11px] text-zinc-600 truncate">
                FoothillSolutions/NexusWorkflowStudio
              </div>
            </div>
            <ExternalLink className="mt-0.5 h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
          </a>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Scale className="h-3 w-3" />
              MIT License
            </span>
            <span className="flex items-center gap-1.5">
              Built with care <Heart className="h-3 w-3 text-red-500/60" />
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


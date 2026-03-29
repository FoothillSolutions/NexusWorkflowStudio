"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CURRENT_VERSION } from "@/lib/changelog";
import {
  ExternalLink,
  Heart,
  Scale,
  Workflow,
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
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 p-0 overflow-hidden gap-0">
        {/* ── Hero section ──────────────────────────────────────── */}
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
          {/* Subtle gradient glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-600/8 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Logo / Icon */}
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-700/30 shadow-lg shadow-emerald-900/20">
            <Workflow className="h-8 w-8 text-emerald-400" />
          </div>

          <DialogHeader className="items-center gap-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-100">
              Nexus Workflow Studio
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              An open-source platform for designing and exporting AI agent workflows
            </DialogDescription>
          </DialogHeader>

          {/* Version badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-zinc-300">
              v{CURRENT_VERSION}
            </span>
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* ── Description ───────────────────────────────────────── */}
        <div className="px-6 py-5">
          <p className="text-[13px] leading-relaxed text-zinc-400">
            Nexus Workflow Studio provides a structured visual environment for
            designing, orchestrating, and exporting AI agent workflows. Build
            complex automation on an intuitive canvas and generate clean,
            portable artifacts that remain transparent, maintainable, and fully
            under your control.
          </p>
        </div>

        <Separator className="bg-zinc-800" />

        {/* ── Links ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 flex flex-col gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-1 transition-colors hover:bg-zinc-800/60"
          >
            <GitHubIcon className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                GitHub Repository
              </div>
              <div className="text-[11px] text-zinc-600 truncate">
                FoothillSolutions/NexusWorkflowStudio
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </a>
        </div>

        <Separator className="bg-zinc-800" />

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[11px] text-zinc-600">
            <span className="flex items-center gap-1">
              <Scale className="h-3 w-3" />
              MIT License
            </span>
            <span className="flex items-center gap-1">
              Made with <Heart className="h-3 w-3 text-red-500/60" />
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-xs text-zinc-400 hover:text-zinc-100"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


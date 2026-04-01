"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  Boxes,
  Check,
  Download,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BG_ELEVATED,
  BG_SURFACE,
  BORDER_DEFAULT,
  BORDER_MUTED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SUBTLE,
} from "@/lib/theme";
import {
  DEFAULT_GENERATION_TARGET,
  GENERATION_TARGETS,
  getGenerationTarget,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import {
  downloadGeneratedWorkflowZip,
  exportGeneratedWorkflowToDirectory,
  pickExportDirectory,
  supportsDirectoryExport,
} from "@/lib/generated-workflow-export";
import { IS_MAC } from "@/lib/platform";
import { useOpenCodeStore } from "@/store/opencode";
import type { WorkflowJSON } from "@/types/workflow";

interface GeneratedExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: GenerationTargetId;
  onTargetChange: (target: GenerationTargetId) => void;
  getWorkflow: () => WorkflowJSON;
}

const TARGET_VISUALS = {
  opencode: {
    Icon: Boxes,
    accentClass: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    activeClass: "border-sky-500/50 bg-sky-500/12 text-sky-200",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  },
  pi: {
    Icon: Boxes,
    accentClass: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    activeClass: "border-violet-500/50 bg-violet-500/12 text-violet-200",
    badgeClass: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  },
  "claude-code": {
    Icon: Boxes,
    accentClass: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    activeClass: "border-amber-500/50 bg-amber-500/12 text-amber-200",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
} as const;

function truncatePath(path: string, maxLen = 70): string {
  if (path.length <= maxLen) return path;
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 3) return path;
  return `${parts[0]}${sep}…${sep}${parts[parts.length - 2]}${sep}${parts[parts.length - 1]}`;
}

export default function GeneratedExportDialog({
  open,
  onOpenChange,
  target,
  onTargetChange,
  getWorkflow,
}: GeneratedExportDialogProps) {
  const currentProject = useOpenCodeStore((state) => state.currentProject);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const supportsFolderExport = supportsDirectoryExport();
  const selectedTarget = useMemo(
    () => getGenerationTarget(target ?? DEFAULT_GENERATION_TARGET),
    [target],
  );
  const selectedTargetVisuals = TARGET_VISUALS[target ?? DEFAULT_GENERATION_TARGET];
  const SelectedTargetIcon = selectedTargetVisuals.Icon;
  const isTargetFolderSelected = directoryHandle?.name === selectedTarget.rootDir;

  const handlePickDirectory = async () => {
    try {
      const handle = await pickExportDirectory();
      setDirectoryHandle(handle);
      toast.success(`Selected ${handle.name}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to select an export directory",
      );
    }
  };

  const handleZipDownload = async () => {
    setIsBusy(true);
    try {
      const workflow = getWorkflow();
      const files = await downloadGeneratedWorkflowZip(workflow, target);
      toast.success(
        `Downloaded ${files.length} ${selectedTarget.label} file${files.length === 1 ? "" : "s"} as ZIP`,
      );
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to download generated files");
    } finally {
      setIsBusy(false);
    }
  };

  const handleFolderExport = async () => {
    if (!directoryHandle) {
      toast.error("Select a target directory first");
      return;
    }

    setIsBusy(true);
    try {
      const workflow = getWorkflow();
      const files = await exportGeneratedWorkflowToDirectory(
        directoryHandle,
        workflow,
        target,
      );
      const destinationLabel = isTargetFolderSelected
        ? directoryHandle.name
        : `${directoryHandle.name}/${selectedTarget.rootDir}`;
      toast.success(
        `Exported ${files.length} ${selectedTarget.label} file${files.length === 1 ? "" : "s"} to ${destinationLabel}.`,
      );
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to export generated files to the selected folder",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`min-h-0 max-h-[90vh] w-full max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] lg:max-w-4xl ${BG_SURFACE} ${BORDER_DEFAULT} ${TEXT_PRIMARY}`}>
        <DialogHeader className="gap-3 border-b border-zinc-800 px-4 py-5 pr-12 sm:px-6 sm:py-6 sm:pr-14">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 shadow-sm shadow-emerald-950/30">
              <SelectedTargetIcon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl">Generate workflow files</DialogTitle>
              <DialogDescription className={`max-w-2xl leading-relaxed ${TEXT_MUTED}`}>
                Choose a target format, then export the generated folder directly into a directory.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 w-full" viewportClassName="overscroll-contain" type="always">
          <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <section className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Generate target
              </div>
              <p className={`mt-1 text-sm ${TEXT_SUBTLE}`}>
                Each target writes its files into <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[11px] text-zinc-300">{selectedTarget.rootDir}</code>.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 xl:auto-rows-fr">
              {GENERATION_TARGETS.map((option) => {
                const isSelected = option.id === target;
                const visuals = TARGET_VISUALS[option.id];
                const TargetIcon = visuals.Icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onTargetChange(option.id)}
                    className={`group flex h-full flex-col rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? `bg-zinc-900/90 shadow-lg shadow-black/20 ${visuals.activeClass}`
                        : `${BORDER_MUTED} ${BG_ELEVATED} hover:border-zinc-700 hover:bg-zinc-800/90`
                    }`}
                  >
                    <div className="flex h-full flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                              isSelected ? visuals.accentClass : "border-zinc-800 bg-zinc-900 text-zinc-400"
                            }`}
                          >
                            <TargetIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-zinc-100">{option.label}</div>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                                  <Check className="h-3 w-3" />
                                  Active
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                              {option.compatibility}
                            </div>
                          </div>
                        </div>
                        <div className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${visuals.badgeClass}`}>
                          <code>{option.rootDir}</code>
                        </div>
                      </div>

                      <p className={`flex-1 text-sm leading-relaxed ${TEXT_MUTED}`}>
                          {option.description}
                      </p>

                      <div className="flex flex-col gap-2 border-t border-zinc-800/80 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <span className={TEXT_SUBTLE}>Exports into this folder structure</span>
                        <span className={`inline-flex items-center gap-1 font-medium ${isSelected ? "text-emerald-300" : "text-zinc-400 transition-colors group-hover:text-zinc-200"}`}>
                          {isSelected ? "Selected" : "Select"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Target directory
                </div>
                <p className={`mt-1 text-sm leading-relaxed ${TEXT_MUTED}`}>
                  The export merges into the target folder and only updates existing files of the current workflow.
                  You can select either the project root or an existing <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300">{selectedTarget.rootDir}</code> folder.
                </p>
                {currentProject?.worktree ? (
                  <p className={`mt-3 text-xs ${TEXT_SUBTLE}`}>
                    Current OpenCode project: <span className="text-zinc-300">{truncatePath(currentProject.worktree)}</span>
                  </p>
                ) : null}
                {IS_MAC && selectedTarget.rootDir.startsWith(".") ? (
                  <p className="mt-3 text-xs leading-relaxed text-amber-300/90">
                    {selectedTarget.rootDir} is a hidden folder on macOS Finder, so it may not be visible unless hidden files are shown. Press <kbd className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-200">⌘</kbd> + <kbd className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-200">⇧</kbd> + <kbd className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-200">.</kbd> in Finder to toggle hidden files.
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handlePickDirectory}
                disabled={isBusy || !supportsFolderExport}
                className="h-10 border-zinc-700 bg-zinc-900 px-4 text-zinc-200 hover:bg-zinc-800 lg:self-start"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Select folder…
              </Button>
            </div>

            <div className={`rounded-xl border ${BORDER_MUTED} bg-zinc-900/80 p-4`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Selected folder</div>
                  <div className="mt-2 text-sm font-medium text-zinc-100">
                    {directoryHandle ? directoryHandle.name : "No folder selected yet"}
                  </div>
                  <div className={`mt-1 text-xs leading-relaxed ${TEXT_SUBTLE}`}>
                    {directoryHandle
                      ? isTargetFolderSelected
                        ? `Files will be written directly into ${directoryHandle.name}`
                        : `Files will be written into ${directoryHandle.name}/${selectedTarget.rootDir}`
                      : `Choose the root folder where ${selectedTarget.rootDir} should be created or updated.`}
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] font-medium text-zinc-300">
                  <code>{selectedTarget.rootDir}</code>
                </div>
              </div>
            </div>

            {!supportsFolderExport ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                Direct folder export requires browser support for the File System Access API.
                ZIP download is still available as a fallback.
              </div>
            ) : null}
          </section>
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 flex-col gap-3 border-t border-zinc-800 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-xs leading-relaxed ${TEXT_SUBTLE}`}>
            Export as a ZIP or write directly into <code className="rounded bg-zinc-950 px-1 py-0.5 text-[11px] text-zinc-300">{selectedTarget.rootDir}</code>.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleZipDownload}
              disabled={isBusy}
              className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            >
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download ZIP
            </Button>
            <Button
              type="button"
              onClick={handleFolderExport}
              disabled={isBusy || !supportsFolderExport || !directoryHandle}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-2 h-4 w-4" />}
              Export to folder
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



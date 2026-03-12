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
import {
  Check,
  Download,
  FolderOpen,
  Loader2,
  Sparkles,
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
import { useOpenCodeStore } from "@/store/opencode-store";
import type { WorkflowJSON } from "@/types/workflow";

interface GeneratedExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: GenerationTargetId;
  onTargetChange: (target: GenerationTargetId) => void;
  getWorkflow: () => WorkflowJSON;
}

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
      <DialogContent className={`sm:max-w-2xl ${BG_SURFACE} ${BORDER_DEFAULT} ${TEXT_PRIMARY}`}>
        <DialogHeader>
          <DialogTitle>Generate workflow files</DialogTitle>
          <DialogDescription className={TEXT_MUTED}>
            Choose a target format, then export the generated folder directly into a directory.
            Existing files with the same path are updated in place, while unrelated files stay untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Generate target
              </div>
              <p className={`mt-1 text-xs ${TEXT_SUBTLE}`}>
                Each target writes its files into <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[11px] text-zinc-300">{selectedTarget.rootDir}</code>.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {GENERATION_TARGETS.map((option) => {
                const isSelected = option.id === target;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onTargetChange(option.id)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : `${BORDER_MUTED} ${BG_ELEVATED} hover:bg-zinc-800`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ${
                          isSelected ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {isSelected ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-100">{option.label}</div>
                        <div className="mt-1 rounded-md bg-zinc-950 px-2 py-1 text-[11px] text-zinc-400">
                          {option.rootDir}
                        </div>
                        <p className={`mt-2 text-xs leading-relaxed ${TEXT_MUTED}`}>
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Target directory
                </div>
                <p className={`mt-1 text-xs leading-relaxed ${TEXT_MUTED}`}>
                  The export merges into the selected folder and only overwrites generated files that share the same name.
                  You can select either the project root or an existing <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300">{selectedTarget.rootDir}</code> folder.
                </p>
                {currentProject?.worktree ? (
                  <p className={`mt-2 text-xs ${TEXT_SUBTLE}`}>
                    Current OpenCode project: <span className="text-zinc-300">{truncatePath(currentProject.worktree)}</span>
                  </p>
                ) : null}
                {IS_MAC && selectedTarget.rootDir.startsWith(".") ? (
                  <p className="mt-2 text-xs text-amber-300/90">
                    {selectedTarget.rootDir} is a hidden folder on macOS Finder, so it may not be visible unless hidden files are shown. Press <kbd className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-200">⌘</kbd> + <kbd className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-200">⇧</kbd> + <kbd className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-200">.</kbd> in Finder to toggle hidden files.
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handlePickDirectory}
                disabled={isBusy || !supportsFolderExport}
                className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Select folder…
              </Button>
            </div>

            <div className={`rounded-lg border ${BORDER_MUTED} bg-zinc-900/80 p-3`}>
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Selected folder</div>
              <div className="mt-1 text-sm text-zinc-100">
                {directoryHandle ? directoryHandle.name : "No folder selected yet"}
              </div>
              <div className={`mt-1 text-xs ${TEXT_SUBTLE}`}>
                {directoryHandle
                  ? isTargetFolderSelected
                    ? `Files will be written directly into ${directoryHandle.name}`
                    : `Files will be written into ${directoryHandle.name}/${selectedTarget.rootDir}`
                  : `Choose the root folder where ${selectedTarget.rootDir} should be created or updated.`}
              </div>
            </div>

            {!supportsFolderExport ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                Direct folder export requires browser support for the File System Access API.
                ZIP download is still available as a fallback.
              </div>
            ) : null}
          </section>
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



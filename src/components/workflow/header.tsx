"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
import { exportWorkflow } from "@/lib/persistence";
import {
  getCommandMarkdown,
} from "@/lib/workflow-generator";
import {
  DEFAULT_GENERATION_TARGET,
  GENERATION_TARGETS,
  getGenerationTarget,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Save,
  Download,
  Cpu,
  Eye,
  Upload,
  FilePlus,
  ChevronDown,
  Sparkles,
  Check,
  PencilLine,
} from "lucide-react";
import { toast } from "sonner";
import ImportDialog from "./import-dialog";
import WorkflowPreviewDialog from "./workflow-preview-dialog";
import GeneratedExportDialog from "./generated-export-dialog";
import UnsavedChangesDialog from "./unsaved-changes-dialog";
import { useWorkflowGenStore } from "@/store/workflow-gen-store";
import { useOpenCodeStore } from "@/store/opencode-store";
import { LibraryToggleButton, HelpMenu, ConnectButton } from "./shared-header-actions";
import { ProjectSwitcher } from "./project-switcher";
import {
  BG_SURFACE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

function ActionRail({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-xl border border-zinc-700/50 bg-zinc-900/80 p-1 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function Header() {
  const name = useWorkflowStore((s) => s.name);
  const setName = useWorkflowStore((s) => s.setName);
  const getWorkflowJSON = useWorkflowStore((s) => s.getWorkflowJSON);
  const reset = useWorkflowStore((s) => s.reset);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const needsSave = useWorkflowStore((s) => s.needsSave);
  const activeWorkflowId = useSavedWorkflowsStore((s) => s.activeId);
  const openCodeStatus = useOpenCodeStore((s) => s.status);
  const isOpenCodeConnected = openCodeStatus === "connected";
  const isWorkflowGenOpen = useWorkflowGenStore((s) => s.floating);
  const [isEditingName, setIsEditingName] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<GenerationTargetId>(DEFAULT_GENERATION_TARGET);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);


  const handleNameBlur = () => setIsEditingName(false);

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") setIsEditingName(false);
  };


  const handleSave = () => {
    const json = getWorkflowJSON();
    useSavedWorkflowsStore.getState().save(json);
    toast.success("Workflow saved to library");
  };

  const handleNew = useCallback(() => {
    reset();
    useSavedWorkflowsStore.getState().clearActiveId();
    window.dispatchEvent(new CustomEvent("nexus:fit-view"));
    toast.success("New workflow created");
  }, [reset]);

  const requestNewWorkflow = useCallback(() => {
    if (needsSave) {
      setConfirmNewOpen(true);
      return;
    }

    handleNew();
  }, [handleNew, needsSave]);

  const handleExport = () => {
    exportWorkflow(getWorkflowJSON());
    toast.success("Workflow JSON exported");
  };

  const openGenerateDialog = useCallback(
    (target: GenerationTargetId = generateTarget) => {
      setGenerateTarget(target);
      setGenerateDialogOpen(true);
    },
    [generateTarget],
  );

  const handleGenerate = useCallback(() => {
    openGenerateDialog();
  }, [openGenerateDialog]);

  const handleView = useCallback(() => {
    const workflow = getWorkflowJSON();
    setPreviewMarkdown(getCommandMarkdown(workflow));
    setPreviewOpen(true);
  }, [getWorkflowJSON]);

  // Listen for custom events dispatched by keyboard shortcuts in workflow-editor
  useEffect(() => {
    const onOpenImport = () => setImportDialogOpen(true);
    const onOpenPreview = () => handleView();
    const onGenerate = () => handleGenerate();
    const onNewWorkflow = () => requestNewWorkflow();
    const onOpenWorkflowGen = () => {
      const store = useWorkflowGenStore.getState();
      store.setFloating(!store.floating);
    };

    window.addEventListener("nexus:open-import", onOpenImport);
    window.addEventListener("nexus:open-preview", onOpenPreview);
    window.addEventListener("nexus:generate", onGenerate);
    window.addEventListener("nexus:new-workflow-request", onNewWorkflow);
    window.addEventListener("nexus:open-workflow-gen", onOpenWorkflowGen);

    return () => {
      window.removeEventListener("nexus:open-import", onOpenImport);
      window.removeEventListener("nexus:open-preview", onOpenPreview);
      window.removeEventListener("nexus:generate", onGenerate);
      window.removeEventListener("nexus:new-workflow-request", onNewWorkflow);
      window.removeEventListener("nexus:open-workflow-gen", onOpenWorkflowGen);
    };
  }, [handleView, handleGenerate, requestNewWorkflow]);

  const statusBadge = needsSave ? (
    <Badge
      variant="outline"
      className="rounded-full border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300"
    >
      {isDirty ? "Modified" : "Draft"}
    </Badge>
  ) : activeWorkflowId ? (
    <Badge
      variant="outline"
      className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300"
    >
      Saved
    </Badge>
  ) : null;


  return (
    <header
      className={`nexus-no-select shrink-0 border-b ${BORDER_DEFAULT} ${BG_SURFACE}/90 px-3 py-2 backdrop-blur-sm z-10`}
    >
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-center pr-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-zinc-200">
                Nexus
                <span className="hidden sm:inline text-zinc-500 font-medium"> Workflow Studio</span>
              </span>
            </div>
          </div>
        </div>

        <div className="hidden h-6 w-px shrink-0 bg-zinc-800/80 xl:block" />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-900/80 px-3 py-2 shadow-lg backdrop-blur-sm">
            <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:inline">
              Workflow
            </span>

            {isEditingName ? (
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                className={`nexus-allow-text-selection ${TEXT_PRIMARY} min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-zinc-600 sm:text-[15px]`}
                placeholder="Untitled workflow"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
              >
                <span className={`${TEXT_PRIMARY} min-w-0 flex-1 truncate text-sm font-medium sm:text-[15px]`}>
                  {name}
                </span>
                <PencilLine className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </button>
            )}

            <div className="hidden h-4 w-px shrink-0 bg-zinc-800/80 lg:block" />

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {statusBadge}
              <Badge
                variant="outline"
                className="hidden rounded-full border-blue-500/20 bg-blue-500/10 px-2 py-0 text-[10px] font-medium text-blue-200 xl:inline-flex"
              >
                {getGenerationTarget(generateTarget).label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <ActionRail>
            <ConnectButton variant="compact" />
            <LibraryToggleButton variant="compact" />
            <ProjectSwitcher
              variant="compact"
              className="rounded-lg border border-transparent bg-transparent hover:bg-zinc-800/80"
            />
          </ActionRail>

          <ActionRail>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${TEXT_MUTED} h-8 rounded-lg px-2.5 text-xs hover:bg-zinc-800/80 hover:text-zinc-100`}
                >
                  File
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={requestNewWorkflow}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  New Workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import…
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {process.env.NODE_ENV === "development" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleView}
                    className={`${TEXT_MUTED} h-8 rounded-lg px-2.5 text-xs hover:bg-zinc-800/80 hover:text-zinc-100`}
                  >
                    <Eye className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Preview</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Preview generated output
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const store = useWorkflowGenStore.getState();
                    store.setFloating(!store.floating);
                  }}
                  disabled={!isOpenCodeConnected}
                  className={`h-8 rounded-lg px-2.5 text-xs disabled:opacity-40 ${
                    isWorkflowGenOpen
                      ? "bg-violet-500/15 text-violet-300 hover:bg-violet-500/20"
                      : `${TEXT_MUTED} hover:bg-zinc-800/80 hover:text-violet-300`
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span className="hidden sm:inline">AI Generate</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Generate a workflow from a description <kbd className="ml-1 text-[10px] opacity-60">Ctrl+Alt+A</kbd>
              </TooltipContent>
            </Tooltip>

            <HelpMenu className="rounded-lg border border-transparent bg-transparent hover:bg-zinc-800/80" />
          </ActionRail>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-8 rounded-xl bg-emerald-600/90 px-3 text-xs font-medium text-white shadow-sm hover:bg-emerald-500"
                title="Choose a target and export generated workflow artifacts"
              >
                <Cpu className="h-4 w-4" />
                Generate
                <ChevronDown className="h-3 w-3 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {GENERATION_TARGETS.map((target) => {
                const isSelected = generateTarget === target.id;
                return (
                  <DropdownMenuItem
                    key={target.id}
                    onClick={() => openGenerateDialog(target.id)}
                    className="py-2"
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-md ${
                        isSelected ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {isSelected ? <Check className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-100">{target.label}</div>
                      <div className="text-xs text-zinc-500">{target.rootDir}</div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────── */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
      <WorkflowPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        markdown={previewMarkdown}
        title={`Preview — ${name} · ${getGenerationTarget(generateTarget).label}`}
        onDownload={handleGenerate}
        downloadLabel="Export…"
      />
      <GeneratedExportDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        target={generateTarget}
        onTargetChange={setGenerateTarget}
        getWorkflow={getWorkflowJSON}
      />
      <UnsavedChangesDialog
        open={confirmNewOpen}
        onOpenChange={setConfirmNewOpen}
        title="Start a new workflow?"
        description="Your current workflow has unsaved work. Starting a new workflow will replace it."
        confirmLabel="Start New Workflow"
        onConfirm={handleNew}
      />
    </header>
  );
}

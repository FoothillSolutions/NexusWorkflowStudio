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

/* ── tiny divider ────────────────────────────────────────────────── */
function Divider() {
  return <div className="h-5 w-px bg-zinc-700/60 mx-1 shrink-0" />;
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
      className={`nexus-no-select min-h-12 ${BG_SURFACE} border-b ${BORDER_DEFAULT} flex flex-wrap items-center px-3 py-1.5 gap-1.5 shrink-0 z-10`}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mr-0.5 shrink-0">
        <span className="text-xs font-semibold tracking-tight text-zinc-300 sm:text-sm">
          Nexus
          <span className="hidden md:inline text-zinc-500"> Workflow Studio</span>
        </span>
      </div>

      <Divider />


      {/* ── Workflow name (editable) ──────────────────────────── */}
      <div className="min-w-0 flex flex-1 items-center gap-2">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className={`nexus-allow-text-selection ${TEXT_PRIMARY} text-sm font-medium bg-transparent border-b border-blue-500 outline-none w-full max-w-xs px-1 py-0.5`}
          />
        ) : (
          <div
            onClick={() => setIsEditingName(true)}
            className={`${TEXT_PRIMARY} text-sm font-medium bg-transparent border-b border-transparent hover:border-zinc-600 cursor-text px-1 py-0.5 truncate max-w-xs`}
          >
            {name}
          </div>
        )}
        {statusBadge}
      </div>

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-0.5">
        {/* Connect to OpenCode */}
        <ConnectButton variant="compact" />

        {/* Library toggle */}
        <LibraryToggleButton variant="compact" />

        {/* Project directory switcher */}
        <ProjectSwitcher variant="compact" />

          {/* File dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${TEXT_MUTED} hover:text-zinc-100 h-8 px-2.5 text-xs gap-1 whitespace-normal shrink min-w-0`}
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

        {/* Preview — dev only */}
        {process.env.NODE_ENV === "development" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleView}
                className={`${TEXT_MUTED} hover:text-zinc-100 h-8 px-2.5 text-xs whitespace-normal shrink min-w-0`}
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

        {/* AI Workflow Generation */}
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
              className={`h-8 px-2.5 text-xs gap-1 whitespace-normal shrink min-w-0 disabled:opacity-40 ${
                isWorkflowGenOpen
                  ? "text-violet-300 bg-violet-500/15 hover:bg-violet-500/20"
                  : `${TEXT_MUTED} hover:text-violet-300`
              }`}
            >
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span className="hidden sm:inline">AI Generate</span>
              <span className="hidden lg:inline px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 leading-none">
                Beta
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Generate a workflow from a description <kbd className="ml-1 text-[10px] opacity-60">Ctrl+Alt+A</kbd>
          </TooltipContent>
        </Tooltip>

        {/* Generate (primary action) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-sm whitespace-normal shrink min-w-0"
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


        {/* Help / More dropdown */}
        <HelpMenu />
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

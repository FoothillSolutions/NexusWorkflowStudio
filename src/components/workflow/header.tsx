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
  return <div className="w-px h-6 bg-zinc-700/60 mx-1.5 shrink-0" />;
}

export default function Header() {
  const name = useWorkflowStore((s) => s.name);
  const setName = useWorkflowStore((s) => s.setName);
  const getWorkflowJSON = useWorkflowStore((s) => s.getWorkflowJSON);
  const reset = useWorkflowStore((s) => s.reset);
  const openCodeStatus = useOpenCodeStore((s) => s.status);
  const isOpenCodeConnected = openCodeStatus === "connected";
  const isWorkflowGenOpen = useWorkflowGenStore((s) => s.floating);
  const [isEditingName, setIsEditingName] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<GenerationTargetId>(DEFAULT_GENERATION_TARGET);
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

  const handleNew = () => {
    reset();
    useSavedWorkflowsStore.getState().clearActiveId();
    window.dispatchEvent(new CustomEvent("nexus:fit-view"));
    toast.success("New workflow created");
  };

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
    const onOpenWorkflowGen = () => {
      const store = useWorkflowGenStore.getState();
      store.setFloating(!store.floating);
    };

    window.addEventListener("nexus:open-import", onOpenImport);
    window.addEventListener("nexus:open-preview", onOpenPreview);
    window.addEventListener("nexus:generate", onGenerate);
    window.addEventListener("nexus:open-workflow-gen", onOpenWorkflowGen);

    return () => {
      window.removeEventListener("nexus:open-import", onOpenImport);
      window.removeEventListener("nexus:open-preview", onOpenPreview);
      window.removeEventListener("nexus:generate", onGenerate);
      window.removeEventListener("nexus:open-workflow-gen", onOpenWorkflowGen);
    };
  }, [handleView, handleGenerate]);


  return (
    <header
      className={`nexus-no-select min-h-13 ${BG_SURFACE} border-b ${BORDER_DEFAULT} flex flex-wrap items-center px-4 py-2 gap-2 shrink-0 z-10`}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mr-1 shrink-0">
        <span className="text-sm font-semibold tracking-tight text-zinc-300">
          Nexus Workflow Studio
        </span>
      </div>

      <Divider />


      {/* ── Workflow name (editable) ──────────────────────────── */}
      <div className="flex-1 min-w-[180px]">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className={`nexus-allow-text-selection ${TEXT_PRIMARY} text-sm font-medium bg-transparent border-b border-blue-500 outline-none w-full max-w-sm px-1 py-0.5`}
          />
        ) : (
          <div
            onClick={() => setIsEditingName(true)}
            className={`${TEXT_PRIMARY} text-sm font-medium bg-transparent border-b border-transparent hover:border-zinc-600 cursor-text px-1 py-0.5 truncate max-w-sm`}
          >
            {name}
          </div>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">
        {/* Connect to OpenCode */}
        <ConnectButton />

        {/* Library toggle */}
        <LibraryToggleButton />

        {/* Project directory switcher */}
        <ProjectSwitcher />

          {/* File dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${TEXT_MUTED} hover:text-zinc-100 h-8 px-3 text-sm gap-1.5 whitespace-normal shrink min-w-0`}
            >
              File
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleNew}>
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


        <Divider />

        {/* Preview — dev only */}
        {process.env.NODE_ENV === "development" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleView}
                className={`${TEXT_MUTED} hover:text-zinc-100 h-8 px-3 text-sm whitespace-normal shrink min-w-0`}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Preview
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
              className={`h-8 px-3 text-sm gap-1.5 whitespace-normal shrink min-w-0 disabled:opacity-40 ${
                isWorkflowGenOpen
                  ? "text-violet-300 bg-violet-500/15 hover:bg-violet-500/20"
                  : `${TEXT_MUTED} hover:text-violet-300`
              }`}
            >
              <Sparkles className="h-4 w-4 text-violet-400" />
              AI Generate
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 leading-none">
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
              className="h-8 px-4 text-sm bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm whitespace-normal shrink min-w-0"
              title="Choose a target and export generated workflow artifacts"
            >
              <Cpu className="h-4 w-4" />
              Generate
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
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

        <Divider />

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
    </header>
  );
}

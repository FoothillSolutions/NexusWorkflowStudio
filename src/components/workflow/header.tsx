"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
import { exportWorkflow } from "@/lib/persistence";
import {
  generateWorkflowFiles,
  getCommandMarkdown,
} from "@/lib/workflow-generator";
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
} from "lucide-react";
import { toast } from "sonner";
import ImportDialog from "./import-dialog";
import WorkflowPreviewDialog from "./workflow-preview-dialog";
import { LibraryToggleButton, HelpMenu, ConnectButton } from "./shared-header-actions";
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
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
    toast.success("New workflow created");
  };

  const handleExport = () => {
    exportWorkflow(getWorkflowJSON());
    toast.success("Workflow exported");
  };

  const handleGenerate = useCallback(async () => {
    const workflow = getWorkflowJSON();
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const files = generateWorkflowFiles(workflow);
      for (const file of files) {
        zip.file(file.path, file.content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName =
        workflow.name
          .replace(/[^a-z0-9\-_ ]/gi, "")
          .trim()
          .replace(/\s+/g, "-")
          .toLowerCase() || "workflow";
      a.href = url;
      a.download = `${safeName}-generated.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Workflow generated and downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate workflow");
    }
  }, [getWorkflowJSON]);

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

    window.addEventListener("nexus:open-import", onOpenImport);
    window.addEventListener("nexus:open-preview", onOpenPreview);
    window.addEventListener("nexus:generate", onGenerate);

    return () => {
      window.removeEventListener("nexus:open-import", onOpenImport);
      window.removeEventListener("nexus:open-preview", onOpenPreview);
      window.removeEventListener("nexus:generate", onGenerate);
    };
  }, [handleView, handleGenerate]);


  return (
    <header
      className={`h-13 ${BG_SURFACE} border-b ${BORDER_DEFAULT} flex items-center px-4 gap-3 shrink-0 z-10`}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mr-1 shrink-0">
        <span className="text-sm font-semibold tracking-tight text-zinc-300">
          Nexus Workflow Studio
        </span>
      </div>

      <Divider />

      {/* ── Workflow name (editable) ──────────────────────────── */}
      <div className="flex-1 min-w-0">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className={`${TEXT_PRIMARY} text-sm font-medium bg-transparent border-b border-blue-500 outline-none w-full max-w-sm px-1 py-0.5`}
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
      <div className="flex items-center gap-1 shrink-0">
        {/* File dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${TEXT_MUTED} hover:text-zinc-100 h-8 px-3 text-sm gap-1.5`}
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
              Export
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Library toggle */}
        <LibraryToggleButton />

        {/* Connect to OpenCode */}
        <ConnectButton />

        <Divider />

        {/* Preview — dev only */}
        {process.env.NODE_ENV === "development" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleView}
                className={`${TEXT_MUTED} hover:text-zinc-100 h-8 px-3 text-sm`}
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

        {/* Generate (primary action) */}
        <Button
          size="sm"
          onClick={handleGenerate}
          className="h-8 px-4 text-sm bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
          title="Generate and download workflow artifacts"
        >
          <Cpu className="h-4 w-4" />
          Generate
        </Button>

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
        title={`Preview — ${name}`}
        onDownload={handleGenerate}
      />
    </header>
  );
}

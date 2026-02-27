"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
import { exportWorkflow } from "@/lib/persistence";
import { generateWorkflowFiles, getCommandMarkdown } from "@/lib/workflow-generator";
import { Button } from "@/components/ui/button";
import { Save, Download, Keyboard, Cpu, Eye, Library, Upload, FilePlus } from "lucide-react";
import { toast } from "sonner";
import ImportDialog from "./import-dialog";
import ShortcutsDialog from "./shortcuts-dialog";
import WorkflowPreviewDialog from "./workflow-preview-dialog";
import {
  BG_SURFACE,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BG_ELEVATED,
} from "@/lib/theme";

export default function Header() {
  const { name, setName, getWorkflowJSON, reset } = useWorkflowStore();
  const librarySidebarOpen = useSavedWorkflowsStore((s) => s.sidebarOpen);
  const [isEditingName, setIsEditingName] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  const handleNameBlur = () => {
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setIsEditingName(false);
    }
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

  /** Download the generated zip containing commands/ and agents/ folders */
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
      const safeName = workflow.name
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

  /** Open the readonly markdown preview dialog */
  const handleView = useCallback(() => {
    const workflow = getWorkflowJSON();
    setPreviewMarkdown(getCommandMarkdown(workflow));
    setPreviewOpen(true);
  }, [getWorkflowJSON]);

  return (
    <header className={`h-12 ${BG_SURFACE} border-b ${BORDER_DEFAULT} flex items-center px-4 gap-3 shrink-0 z-10`}>
      <div className={`text-sm font-semibold ${TEXT_SECONDARY} mr-2`}>
        Nexus Workflow Studio
      </div>

      <div className="flex-1">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className={`${TEXT_PRIMARY} font-medium bg-transparent border-b border-blue-500 outline-none w-full max-w-sm px-1 py-0.5`}
          />
        ) : (
          <div
            onClick={() => setIsEditingName(true)}
            className={`${TEXT_PRIMARY} font-medium bg-transparent border-b border-transparent hover:border-zinc-600 cursor-text px-1 py-0.5 truncate max-w-sm`}
          >
            {name}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setShortcutsOpen(true)} className={`${TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`} title="Keyboard shortcuts">
          <Keyboard className="h-4 w-4 mr-2" />
          Shortcuts
        </Button>
        <Button variant="ghost" size="sm" onClick={handleNew} className={`${TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`} title="Create a new workflow">
          <FilePlus className="h-4 w-4 mr-2" />
          New
        </Button>
        <Button variant="ghost" size="sm" onClick={handleSave} className={`${TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => useSavedWorkflowsStore.getState().toggleSidebar()} className={`${librarySidebarOpen ? "text-blue-400 bg-zinc-800" : TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`}>
          <Library className="h-4 w-4 mr-2" />
          Library
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setImportDialogOpen(true)} className={`${TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExport} className={`${TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-700 mx-1" />

        <Button variant="ghost" size="sm" onClick={handleView} className={`${TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`} title="Preview generated output">
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          className="text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800"
          title="Generate and download workflow artifacts"
        >
          <Cpu className="h-4 w-4 mr-2" />
          Generate
        </Button>
      </div>

      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
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

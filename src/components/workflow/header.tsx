"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { saveToLocalStorage, exportWorkflow } from "@/lib/persistence";
import { generateWorkflowFiles, getCommandMarkdown } from "@/lib/workflow-generator";
import { Button } from "@/components/ui/button";
import { Save, FolderOpen, Download, Keyboard, Cpu, Eye } from "lucide-react";
import { toast } from "sonner";
import LoadDialog from "./load-dialog";
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
  const { name, setName, getWorkflowJSON } = useWorkflowStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
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
    saveToLocalStorage(getWorkflowJSON());
    toast.success("Workflow saved");
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

      // Ensure the agents folder always exists (placeholder for future use)
      zip.folder("agents");

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
        <Button variant="ghost" size="sm" onClick={handleSave} className={`${TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setLoadDialogOpen(true)} className={`${TEXT_MUTED} hover:text-zinc-100 hover:${BG_ELEVATED}`}>
          <FolderOpen className="h-4 w-4 mr-2" />
          Load
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

      <LoadDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen} />
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

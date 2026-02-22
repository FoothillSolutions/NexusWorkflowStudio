"use client";

import { useState, useRef, useEffect } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { saveToLocalStorage, exportWorkflow } from "@/lib/persistence";
import { Button } from "@/components/ui/button";
import { Save, FolderOpen, Download } from "lucide-react";
import { toast } from "sonner";
import LoadDialog from "./load-dialog";
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
      </div>

      <LoadDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen} />
    </header>
  );
}

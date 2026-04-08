"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TEXT_MUTED } from "@/lib/theme";
import {
  ChevronDown,
  Download,
  Eye,
  FilePlus,
  Save,
  Upload,
} from "lucide-react";
import { ProjectSwitcher } from "../project-switcher";
import { BrainToggleButton, LibraryToggleButton } from "../shared-header-actions";
import { ActionRail } from "./primitives";

interface HeaderWorkflowActionsProps {
  onRequestNewWorkflow: () => void;
  onSave: () => void;
  onOpenImport: () => void;
  onExport: () => void;
  onPreview: () => void;
  showPreview: boolean;
}

export function HeaderWorkflowActions({
  onRequestNewWorkflow,
  onSave,
  onOpenImport,
  onExport,
  onPreview,
  showPreview,
}: HeaderWorkflowActionsProps) {
  return (
    <ActionRail>
      <LibraryToggleButton variant="compact" />
      <BrainToggleButton variant="compact" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`${TEXT_MUTED} h-8 rounded-lg px-2.5 text-xs hover:bg-zinc-800/80 hover:text-zinc-100`}
          >
            Workflow
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onRequestNewWorkflow}>
            <FilePlus className="mr-2 h-4 w-4" />
            New Workflow
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSave}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenImport}>
            <Upload className="mr-2 h-4 w-4" />
            Import…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectSwitcher
        variant="compact"
        className="rounded-lg border border-transparent bg-transparent hover:bg-zinc-800/80"
      />

      {showPreview && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreview}
              className={`${TEXT_MUTED} h-8 rounded-lg px-2.5 text-xs hover:bg-zinc-800/80 hover:text-zinc-100`}
            >
              <Eye className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Preview generated output</TooltipContent>
        </Tooltip>
      )}
    </ActionRail>
  );
}


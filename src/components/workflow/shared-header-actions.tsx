"use client";

import { useState, useCallback, useEffect } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Save,
  Library,
  HelpCircle,
  BookOpen,
  Newspaper,
  MessageSquare,
  Bug,
  Info,
  Keyboard,
} from "lucide-react";
import { toast } from "sonner";
import { TEXT_MUTED } from "@/lib/theme";
import ShortcutsDialog from "./shortcuts-dialog";

/* ── Save Button ─────────────────────────────────────────────────────────── */

interface SaveButtonProps {
  /** Extra classes for the button */
  className?: string;
  /** Padding variant: 'compact' for sub-header, 'default' for main header */
  variant?: "compact" | "default";
}

export function SaveButton({ className, variant = "default" }: SaveButtonProps) {
  const handleSave = useCallback(() => {
    const json = useWorkflowStore.getState().getWorkflowJSON();
    useSavedWorkflowsStore.getState().save(json);
    toast.success("Workflow saved to library");
  }, []);

  const px = variant === "compact" ? "px-2" : "px-3";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className={`${TEXT_MUTED} hover:text-zinc-100 h-8 ${px} text-sm ${className ?? ""}`}
        >
          <Save className="h-4 w-4 mr-1.5" />
          Save
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Save workflow to library</TooltipContent>
    </Tooltip>
  );
}

/* ── Library Toggle Button ───────────────────────────────────────────────── */

interface LibraryToggleButtonProps {
  className?: string;
  variant?: "compact" | "default";
}

export function LibraryToggleButton({ className, variant = "default" }: LibraryToggleButtonProps) {
  const librarySidebarOpen = useSavedWorkflowsStore((s) => s.sidebarOpen);

  const px = variant === "compact" ? "px-2" : "px-3";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useSavedWorkflowsStore.getState().toggleSidebar()}
          className={`h-8 ${px} text-sm ${
            librarySidebarOpen
              ? "text-blue-400 bg-zinc-800/80"
              : TEXT_MUTED
          } hover:text-zinc-100 ${className ?? ""}`}
        >
          <Library className="h-4 w-4 mr-1.5" />
          Library
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Toggle saved workflows</TooltipContent>
    </Tooltip>
  );
}

/* ── Help Menu (dropdown + shortcuts dialog) ─────────────────────────────── */

interface HelpMenuProps {
  className?: string;
}

export function HelpMenu({ className }: HelpMenuProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const handleComingSoon = useCallback(() => toast("Coming soon!", { icon: "🚧" }), []);

  // Allow external trigger (e.g. "?" keyboard shortcut in workflow-editor)
  useEffect(() => {
    const handler = () => setShortcutsOpen(true);
    window.addEventListener("nexus:open-shortcuts", handler);
    return () => window.removeEventListener("nexus:open-shortcuts", handler);
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={`${TEXT_MUTED} hover:text-zinc-100 size-8 ${className ?? ""}`}
          >
            <HelpCircle className="h-[18px] w-[18px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="h-4 w-4 mr-2" />
            Keyboard Shortcuts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled onClick={handleComingSoon}>
            <BookOpen className="h-4 w-4 mr-2" />
            Tutorial
            <DropdownMenuShortcut className="text-[10px] text-zinc-600">
              Soon
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled onClick={handleComingSoon}>
            <Newspaper className="h-4 w-4 mr-2" />
            Patch Notes
            <DropdownMenuShortcut className="text-[10px] text-zinc-600">
              Soon
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled onClick={handleComingSoon}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
            <DropdownMenuShortcut className="text-[10px] text-zinc-600">
              Soon
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled onClick={handleComingSoon}>
            <Bug className="h-4 w-4 mr-2" />
            Report a Bug
            <DropdownMenuShortcut className="text-[10px] text-zinc-600">
              Soon
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled onClick={handleComingSoon}>
            <Info className="h-4 w-4 mr-2" />
            About
            <DropdownMenuShortcut className="text-[10px] text-zinc-600">
              Soon
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}


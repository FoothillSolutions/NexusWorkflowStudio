"use client";

import { useState, useCallback, useEffect } from "react";
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
  Library,
  HelpCircle,
  BookOpen,
  Newspaper,
  MessageSquare,
  Bug,
  Info,
  Keyboard,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { TEXT_MUTED } from "@/lib/theme";
import { useOpenCodeStore } from "@/store/opencode-store";
import ShortcutsDialog from "./shortcuts-dialog";
import AboutDialog from "./about-dialog";
import ConnectDialog from "./connect-dialog";

/* ── Library Toggle Button ───────────────────────────────────────────────── */

interface LibraryToggleButtonProps {
  className?: string;
  variant?: "compact" | "default";
}

export function LibraryToggleButton({ className, variant = "default" }: LibraryToggleButtonProps) {
  const librarySidebarOpen = useSavedWorkflowsStore((s) => s.sidebarOpen);
  const isCompact = variant === "compact";

  const px = isCompact ? "px-0" : "px-3";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={isCompact ? "icon-sm" : "sm"}
          onClick={() => useSavedWorkflowsStore.getState().toggleSidebar()}
          aria-label="Toggle library"
          className={`${isCompact ? "size-8" : `h-8 ${px} text-sm`} ${
            librarySidebarOpen
              ? "text-blue-400 bg-zinc-800/80"
              : TEXT_MUTED
          } hover:text-zinc-100 ${className ?? ""}`}
        >
          <Library className={`h-4 w-4 ${isCompact ? "" : "mr-1.5"}`} />
          {!isCompact && "Library"}
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
  const [aboutOpen, setAboutOpen] = useState(false);

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
            <HelpCircle className="h-4.5 w-4.5" />
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
          <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent("nexus:open-patch-notes"))}>
            <Newspaper className="h-4 w-4 mr-2" />
            Patch Notes
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
          <DropdownMenuItem onClick={() => setAboutOpen(true)}>
            <Info className="h-4 w-4 mr-2" />
            About
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}

/* ── Connect to OpenCode Button ──────────────────────────────────────────── */

interface ConnectButtonProps {
  className?: string;
  variant?: "compact" | "default";
}

export function ConnectButton({ className, variant = "default" }: ConnectButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const status = useOpenCodeStore((s) => s.status);
  const isCompact = variant === "compact";

  const px = isCompact ? "px-0" : "px-3";

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isError = status === "error";

  const dotColor = isConnected
    ? "bg-emerald-400"
    : isError
      ? "bg-red-400"
      : isConnecting
        ? "bg-amber-400"
        : "bg-zinc-600";

  const labelColor = isConnected
    ? "text-emerald-400"
    : isError
      ? "text-red-400"
      : TEXT_MUTED;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={isCompact ? "icon-sm" : "sm"}
            onClick={() => setDialogOpen(true)}
            aria-label={isConnected ? "Connection status" : "Connect to OpenCode"}
            className={`${isCompact ? "size-8" : `h-8 ${px} text-sm gap-1.5`} ${labelColor} hover:text-zinc-100 ${className ?? ""}`}
          >
            <span className="relative flex items-center">
              <Radio className="h-4 w-4" />
              <span
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${dotColor} ${
                  isConnected ? "animate-pulse" : ""
                } ${isConnecting ? "animate-pulse" : ""} ring-2 ring-zinc-900`}
              />
            </span>
            {!isCompact && (isConnected ? "Connected" : "Connect")}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isConnected
            ? "Connected to opencode server"
            : isError
              ? "Connection failed — click to retry"
              : "Connect to opencode server"}
        </TooltipContent>
      </Tooltip>

      <ConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}


"use client";

import { useState, useCallback, useEffect } from "react";
import { useSavedWorkflowsStore } from "@/store/library";
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
  Folders,
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
import { useOpenCodeStore } from "@/store/opencode";
import { cn } from "@/lib/utils";
import ShortcutsDialog from "./shortcuts-dialog";
import AboutDialog from "./about-dialog";
import ConnectDialog from "./connect-dialog";

function chromeButtonClass(isCompact: boolean) {
  return isCompact
    ? "group h-8 rounded-lg border border-transparent bg-transparent px-2.5 text-xs gap-1.5"
    : "group h-8 rounded-lg border border-transparent bg-transparent px-3 text-sm gap-1.5";
}

/* ── Library Toggle Button ───────────────────────────────────────────────── */

interface LibraryToggleButtonProps {
  className?: string;
  variant?: "compact" | "default";
}

export function LibraryToggleButton({ className, variant = "default" }: LibraryToggleButtonProps) {
  const librarySidebarOpen = useSavedWorkflowsStore((s) => s.sidebarOpen);
  const isCompact = variant === "compact";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useSavedWorkflowsStore.getState().toggleSidebar()}
          aria-label="Toggle library"
          aria-pressed={librarySidebarOpen}
          title="Library"
          className={cn(
            chromeButtonClass(isCompact),
            librarySidebarOpen
              ? "border-blue-500/25 bg-blue-500/10 text-blue-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              : `${TEXT_MUTED} hover:border-zinc-700/70 hover:bg-zinc-800/80 hover:text-zinc-100`,
            className,
          )}
        >
          <span
            className={cn(
              "flex size-5.5 shrink-0 items-center justify-center transition-colors",
              librarySidebarOpen
                ? "text-blue-300"
                : "text-zinc-400 group-hover:text-zinc-200",
            )}
          >
            <Folders className="h-3.5 w-3.5" />
          </span>
          <span className={cn(isCompact ? "text-xs font-medium" : "")}>Library</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Open Library</TooltipContent>
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

/* ── Connect AI Endpoint Button ──────────────────────────────────────────── */

interface ConnectButtonProps {
  className?: string;
  variant?: "compact" | "default";
}

export function ConnectButton({ className, variant = "default" }: ConnectButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const status = useOpenCodeStore((s) => s.status);
  const connectedAgent = useOpenCodeStore((s) => s.connectedAgent);
  const isCompact = variant === "compact";

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

  const buttonStateClass = isConnected
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : isError
      ? "border-red-500/25 bg-red-500/10 text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      : isConnecting
        ? "border-amber-500/25 bg-amber-500/10 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        : `${TEXT_MUTED} hover:border-zinc-700/70 hover:bg-zinc-800/80 hover:text-zinc-100`;

  const iconStateClass = isConnected
    ? "text-emerald-300"
    : isError
      ? "text-red-300"
      : isConnecting
        ? "text-amber-300"
        : "text-zinc-400 group-hover:text-zinc-200";

  const label = isConnected
    ? (connectedAgent ?? "Connected")
    : isConnecting
      ? "Connecting"
      : isError
        ? "Retry"
        : "Connect";

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialogOpen(true)}
            aria-label={isConnected ? "Connection status" : "Connect to AI endpoint"}
            title={label}
            className={cn(chromeButtonClass(isCompact), buttonStateClass, className)}
          >
            <span
              className={cn(
                "relative flex size-5.5 shrink-0 items-center justify-center transition-colors",
                iconStateClass,
              )}
            >
              <Radio className="h-3.5 w-3.5" />
              <span
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${dotColor} ${
                  isConnected ? "animate-pulse" : ""
                } ${isConnecting ? "animate-pulse" : ""} ring-2 ring-zinc-900`}
              />
            </span>
            <span className={cn(isCompact ? "text-xs font-medium" : "")}>{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isConnected
            ? connectedAgent
              ? `Connected to ${connectedAgent}`
              : "Connected to AI server"
            : isError
              ? "Connection failed, click to retry"
              : "Connect to an AI endpoint"}
        </TooltipContent>
      </Tooltip>

      <ConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}


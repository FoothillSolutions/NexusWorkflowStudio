import type { ElementType } from "react";
import {
  Bot,
  FileCode2,
  FileText,
  GitBranch,
  LayoutGrid,
  Layers,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { LIBRARY_CATEGORIES } from "@/lib/library";
import { NODE_ACCENT } from "@/lib/node-colors";
import { cn } from "@/lib/utils";
import { BORDER_MUTED } from "@/lib/theme";
import {
  WORKFLOW_PANEL_SURFACE_CLASS,
  buildWorkflowPanelShellClass,
} from "../panel-primitives";
import type { LibraryPanelCategory } from "./types";

export const PANEL_SHELL_CLASS = buildWorkflowPanelShellClass("top-4 right-4");
export const PANEL_SURFACE_CLASS = WORKFLOW_PANEL_SURFACE_CLASS;
export const CARD_CLASS = `group rounded-2xl border ${BORDER_MUTED} bg-zinc-900/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 hover:border-zinc-600/80 hover:bg-zinc-900/80`;
export const META_BADGE_CLASS =
  "rounded-full border border-zinc-700/60 bg-zinc-950/70 px-2 py-0.5 text-[11px] font-medium text-zinc-400";

export const CATEGORY_ICONS: Record<LibraryPanelCategory, ElementType> = {
  all: LayoutGrid,
  workflow: GitBranch,
  agent: Bot,
  skill: Wrench,
  document: FileText,
  prompt: MessageSquare,
  script: FileCode2,
};

export const CATEGORY_ACCENT_HEX: Record<LibraryPanelCategory, string | null> = {
  all: null,
  workflow: NODE_ACCENT["sub-workflow"],
  prompt: NODE_ACCENT.prompt,
  script: NODE_ACCENT.script,
  agent: NODE_ACCENT.agent,
  skill: NODE_ACCENT.skill,
  document: NODE_ACCENT.document,
};

export function getLibraryCategoryLabel(category: LibraryPanelCategory): string {
  return LIBRARY_CATEGORIES.find((entry) => entry.value === category)?.label ?? "All";
}

export function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;

  return `${Math.floor(minutes / 1_440)}d ago`;
}

export function cardIconButtonClass(tone: "default" | "danger" = "default") {
  return cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-zinc-950/70 text-zinc-500 transition-all duration-150",
    tone === "danger"
      ? "hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
      : "hover:border-zinc-700/70 hover:bg-zinc-800/80 hover:text-zinc-100",
  );
}

export const SECTION_HEADER_BADGE_CLASS =
  "rounded-full border-zinc-700/70 bg-zinc-950/70 px-2 py-0 text-[10px] font-medium text-zinc-400";

export const EMPTY_STATE_FALLBACK_ICON = Layers;


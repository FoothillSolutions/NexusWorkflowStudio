import type { GenerationTargetId } from "./generation-targets";

/**
 * Per-target accent classes shared by the Generate menu and the export dialog.
 * Each target gets its own colour family so the UI mirrors the runtime that
 * will receive the generated artifacts (Claude Code = amber, OpenCode = sky,
 * PI = violet). Components should prefer these tokens over hard-coded
 * emerald / blue accents.
 */
export interface GenerationTargetVisuals {
  /** Card border + background when this target is the active selection. */
  activeCardClass: string;
  /** Icon-bubble accent for the active selection (used inside cards). */
  activeIconBubbleClass: string;
  /** Pill / badge variant (e.g. the rootDir chip). */
  badgeClass: string;
  /** Solid primary button (Generate / Export to folder). */
  primaryButtonClass: string;
  /** Header icon bubble in the export dialog. */
  headerBubbleClass: string;
  /** "Active" pill on the currently-selected card. */
  activePillClass: string;
  /** Inline "Selected" text accent in the card footer. */
  selectedTextClass: string;
  /** Dropdown-menu icon background when the row is the active selection. */
  menuActiveClass: string;
}

export const GENERATION_TARGET_VISUALS: Record<GenerationTargetId, GenerationTargetVisuals> = {
  "claude-code": {
    activeCardClass: "border-amber-500/50 bg-amber-500/12 text-amber-200",
    activeIconBubbleClass: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    primaryButtonClass: "bg-amber-600 text-white hover:bg-amber-500",
    headerBubbleClass: "border-amber-500/20 bg-amber-500/10 text-amber-300 shadow-amber-950/30",
    activePillClass: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    selectedTextClass: "text-amber-300",
    menuActiveClass: "bg-amber-500/15 text-amber-300",
  },
  opencode: {
    activeCardClass: "border-sky-500/50 bg-sky-500/12 text-sky-200",
    activeIconBubbleClass: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    primaryButtonClass: "bg-sky-600 text-white hover:bg-sky-500",
    headerBubbleClass: "border-sky-500/20 bg-sky-500/10 text-sky-300 shadow-sky-950/30",
    activePillClass: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    selectedTextClass: "text-sky-300",
    menuActiveClass: "bg-sky-500/15 text-sky-300",
  },
  pi: {
    activeCardClass: "border-violet-500/50 bg-violet-500/12 text-violet-200",
    activeIconBubbleClass: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    badgeClass: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    primaryButtonClass: "bg-violet-600 text-white hover:bg-violet-500",
    headerBubbleClass: "border-violet-500/20 bg-violet-500/10 text-violet-300 shadow-violet-950/30",
    activePillClass: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    selectedTextClass: "text-violet-300",
    menuActiveClass: "bg-violet-500/15 text-violet-300",
  },
};

export function getGenerationTargetVisuals(target: GenerationTargetId): GenerationTargetVisuals {
  return GENERATION_TARGET_VISUALS[target];
}


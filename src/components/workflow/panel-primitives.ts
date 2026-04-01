import { cn } from "@/lib/utils";

export const WORKFLOW_PANEL_SHELL_BASE_CLASS =
  "z-20 flex min-h-0 flex-col overflow-hidden rounded-3xl border border-zinc-700/60 bg-zinc-950/88 shadow-[0_16px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all duration-300 ease-out";

export const WORKFLOW_PANEL_SURFACE_CLASS =
  "rounded-2xl border border-zinc-800/80 bg-zinc-900/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

export function buildWorkflowPanelShellClass(positionClassName: string) {
  return cn("absolute", positionClassName, WORKFLOW_PANEL_SHELL_BASE_CLASS);
}

export function buildWorkflowIconToggleButtonClass(textMutedClass: string) {
  return cn(
    "h-9 w-9 rounded-xl border border-zinc-700/50 bg-zinc-900/80 backdrop-blur-sm shadow-lg transition-all duration-200 hover:bg-zinc-800/80 hover:text-zinc-100",
    textMutedClass,
  );
}


import type { ElementType } from "react";
import { BookOpen, ClipboardList, Database, FileText, Map } from "lucide-react";
import type { KnowledgeDocType, KnowledgeDocStatus, FeedbackRating } from "@/types/knowledge";
import { WORKFLOW_PANEL_SURFACE_CLASS, buildWorkflowPanelShellClass } from "../panel-primitives";
import { BORDER_MUTED } from "@/lib/theme";

export const PANEL_SHELL_CLASS = buildWorkflowPanelShellClass("top-4 right-4");
export const PANEL_SURFACE_CLASS = WORKFLOW_PANEL_SURFACE_CLASS;
export const CARD_CLASS = `group rounded-2xl border ${BORDER_MUTED} bg-zinc-900/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 hover:border-zinc-600/80 hover:bg-zinc-900/80`;

export const DOC_TYPE_ICONS: Record<KnowledgeDocType, ElementType> = {
  note: FileText,
  summary: BookOpen,
  runbook: ClipboardList,
  guide: Map,
  data: Database,
};

export const DOC_TYPE_ACCENT_HEX: Record<KnowledgeDocType, string> = {
  note: "#38bdf8",     // sky-400
  summary: "#818cf8",  // indigo-400
  runbook: "#fb923c",  // orange-400
  guide: "#34d399",    // emerald-400
  data: "#60a5fa",     // blue-400
};

export const DOC_TYPE_LABELS: Record<KnowledgeDocType, string> = {
  note: "Note",
  summary: "Summary",
  runbook: "Runbook",
  guide: "Guide",
  data: "Data",
};

export const STATUS_LABELS: Record<KnowledgeDocStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export const STATUS_COLORS: Record<KnowledgeDocStatus, string> = {
  draft: "border-zinc-700/60 bg-zinc-800/40 text-zinc-400",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-zinc-700/40 bg-zinc-900/50 text-zinc-500",
};

export const FEEDBACK_COLORS: Record<FeedbackRating, string> = {
  success: "text-emerald-400",
  failure: "text-red-400",
  neutral: "text-zinc-500",
};

export const DOC_TYPE_FILTERS: { value: KnowledgeDocType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "note", label: "Note" },
  { value: "summary", label: "Summary" },
  { value: "runbook", label: "Runbook" },
  { value: "guide", label: "Guide" },
  { value: "data", label: "Data" },
];

export const STATUS_FILTERS: { value: KnowledgeDocStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

export function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1_440)}d ago`;
}

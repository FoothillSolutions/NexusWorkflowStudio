"use client";

import { X, Plus, Trash2, PenLine } from "lucide-react";
import { BG_SURFACE, BORDER_DEFAULT, TEXT_PRIMARY, TEXT_MUTED } from "@/lib/theme";
import type { WorkflowChanges, ChangeEvent } from "@/lib/workspace/types";

// Same 8 hue slots used in awareness-names.ts
const HUE_SLOTS = [
  { color: "#7c3aed", colorLight: "#ede9fe" }, // violet
  { color: "#0284c7", colorLight: "#e0f2fe" }, // sky
  { color: "#d97706", colorLight: "#fef3c7" }, // amber
  { color: "#059669", colorLight: "#d1fae5" }, // emerald
  { color: "#e11d48", colorLight: "#ffe4e6" }, // rose
  { color: "#4f46e5", colorLight: "#e0e7ff" }, // indigo
  { color: "#ea580c", colorLight: "#ffedd5" }, // orange
  { color: "#0d9488", colorLight: "#ccfbf1" }, // teal
];

function getColorForName(name: string): { color: string; colorLight: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash += name.charCodeAt(i);
  }
  return HUE_SLOTS[hash % HUE_SLOTS.length];
}

function formatSinceDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function EventIcon({ type }: { type: ChangeEvent["type"] }) {
  switch (type) {
    case "node_added":
      return <Plus className="h-3.5 w-3.5 text-emerald-400" />;
    case "node_deleted":
      return <Trash2 className="h-3.5 w-3.5 text-red-400" />;
    case "node_renamed":
      return <PenLine className="h-3.5 w-3.5 text-amber-400" />;
  }
}

function eventDescription(event: ChangeEvent): string {
  switch (event.type) {
    case "node_added":
      return `added ${event.nodeName}`;
    case "node_deleted":
      return `deleted ${event.nodeName}`;
    case "node_renamed":
      return `renamed ${event.from} → ${event.to}`;
  }
}

interface ChangesPanelProps {
  changes: WorkflowChanges[];
  since: string;
  onDismiss: () => void;
}

export function ChangesPanel({ changes, since, onDismiss }: ChangesPanelProps) {
  const totalChanges = changes.reduce((sum, wf) => sum + wf.changeCount, 0);

  return (
    <div
      className={`fixed right-0 top-0 z-40 flex h-full w-80 flex-col ${BG_SURFACE} border-l ${BORDER_DEFAULT} shadow-2xl animate-in slide-in-from-right duration-300`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between border-b ${BORDER_DEFAULT} px-4 py-3`}>
        <div>
          <h2 className={`text-sm font-semibold ${TEXT_PRIMARY}`}>
            {totalChanges} change{totalChanges !== 1 ? "s" : ""}
          </h2>
          <p className={`text-xs ${TEXT_MUTED}`}>since {formatSinceDate(since)}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={`rounded-md p-1 ${TEXT_MUTED} transition-colors hover:bg-zinc-800 hover:text-zinc-200`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {changes.map((wf) => (
          <div key={wf.workflowId} className="mb-4 last:mb-0">
            <h3 className={`mb-2 text-xs font-medium uppercase tracking-wide ${TEXT_MUTED}`}>
              {wf.workflowName}
            </h3>
            <div className="space-y-1.5">
              {wf.events.map((event, i) => {
                const { color } = getColorForName(event.by);
                const initial = event.by.charAt(0).toUpperCase();
                return (
                  <div key={`${event.type}-${event.nodeName}-${i}`} className="flex items-start gap-2">
                    {/* Colored initial badge */}
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {initial}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs leading-5">
                      <EventIcon type={event.type} />
                      <span className={TEXT_PRIMARY}>
                        <span className="font-medium">{event.by}</span>{" "}
                        <span className={TEXT_MUTED}>{eventDescription(event)}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

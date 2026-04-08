"use client";

import { useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Brain, Download, Plus, Search, Trash2, Upload, X, Pencil, Eye } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useKnowledgeStore } from "@/store/knowledge-store";
import { filterDocs, computeSuccessRate } from "@/store/knowledge/helpers";
import type { KnowledgeDoc } from "@/types/knowledge";
import {
  PANEL_SHELL_CLASS,
  PANEL_SURFACE_CLASS,
  CARD_CLASS,
  DOC_TYPE_ICONS,
  DOC_TYPE_ACCENT_HEX,
  STATUS_LABELS,
  STATUS_COLORS,
  FEEDBACK_COLORS,
  DOC_TYPE_FILTERS,
  STATUS_FILTERS,
  formatTimeAgo,
} from "./constants";
import { DocEditor } from "./doc-editor";
import { useState } from "react";
import { cn } from "@/lib/utils";

function FeedbackDots({ doc }: { doc: KnowledgeDoc }) {
  const latest = doc.metrics.feedback.slice(-5);
  if (latest.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5">
      {latest.map((fb) => (
        <span
          key={fb.id}
          className={cn("text-[9px] font-bold", FEEDBACK_COLORS[fb.rating])}
          title={`${fb.rating}: ${fb.note}`}
        >
          {fb.rating === "success" ? "✓" : fb.rating === "failure" ? "✗" : "–"}
        </span>
      ))}
    </span>
  );
}

function DocCard({
  doc,
  onEdit,
  onDelete,
}: {
  doc: KnowledgeDoc;
  onEdit: (id: string) => void;
  onDelete: (doc: KnowledgeDoc) => void;
}) {
  const Icon = DOC_TYPE_ICONS[doc.docType];
  const hex = DOC_TYPE_ACCENT_HEX[doc.docType];

  return (
    <div className={CARD_CLASS}>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Icon badge */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            style={{ backgroundColor: `${hex}18`, borderColor: `${hex}30`, color: hex }}
          >
            <Icon size={14} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-zinc-100">{doc.title}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  STATUS_COLORS[doc.status],
                )}
              >
                {STATUS_LABELS[doc.status]}
              </span>
            </div>
            {doc.summary && (
              <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{doc.summary}</p>
            )}
            {doc.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {doc.tags.slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-400"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
            {/* Footer */}
            <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-600">
              <span className="flex items-center gap-1">
                <Eye size={10} />
                {doc.metrics.views}
              </span>
              {doc.associatedWorkflowIds.length > 0 && (
                <span>{doc.associatedWorkflowIds.length} linked</span>
              )}
              <FeedbackDots doc={doc} />
              <span className="ml-auto">{formatTimeAgo(doc.updatedAt)}</span>
            </div>
          </div>

          {/* Actions (hover) */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(doc.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-zinc-500 transition-all hover:border-zinc-700/70 hover:bg-zinc-800/80 hover:text-zinc-100"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(doc)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-zinc-500 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrainPanel() {
  const {
    docs,
    panelOpen,
    searchQuery,
    activeDocType,
    activeStatus,
    closePanel,
    openEditor,
    deleteDoc,
    setSearchQuery,
    setActiveDocType,
    setActiveStatus,
    exportBrain,
    importBrain,
  } = useKnowledgeStore();

  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDoc | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const filtered = filterDocs(docs, searchQuery, activeDocType, activeStatus);
  const activeCount = docs.filter((d) => d.status === "active").length;
  const successPct = computeSuccessRate(docs);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importBrain(file);
    e.target.value = "";
  };

  return (
    <>
      <div
        className={`${PANEL_SHELL_CLASS} ${
          panelOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0"
        }`}
        style={{
          width: "min(420px, calc(100vw - 32px))",
          height: "calc(100vh - 112px)",
          maxHeight: "calc(100vh - 112px)",
        }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-zinc-800/80 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-linear-to-br from-sky-500/15 to-indigo-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <Brain className="h-4 w-4 text-sky-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-100">Brain</span>
                <Badge
                  variant="outline"
                  className="rounded-full border-zinc-700/70 bg-zinc-950/70 px-2 py-0 text-[10px] font-medium text-zinc-400"
                >
                  {docs.length} docs
                </Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Center of excellence knowledge base
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={exportBrain}
                      className="h-8 w-8 rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                    >
                      <Download size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Export brain as JSON</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => importInputRef.current?.click()}
                      className="h-8 w-8 rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                    >
                      <Upload size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Import brain JSON</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={closePanel}
                className="h-8 w-8 rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className={`${PANEL_SURFACE_CLASS} p-2.5`}>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-700/50 bg-zinc-950/70 pl-9 pr-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* DocType filter */}
        <div className="shrink-0 px-3 pb-2">
          <div className={`${PANEL_SURFACE_CLASS} p-2`}>
            <div className="flex flex-wrap gap-1">
              {DOC_TYPE_FILTERS.map(({ value, label }) => {
                const isActive = activeDocType === value;
                const hex =
                  value !== "all" ? DOC_TYPE_ACCENT_HEX[value] : null;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveDocType(value)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
                      isActive
                        ? "shadow-sm"
                        : "border-transparent text-zinc-500 hover:border-zinc-700/70 hover:text-zinc-300",
                    )}
                    style={
                      isActive
                        ? {
                            backgroundColor: hex ? `${hex}14` : "rgba(63,63,70,0.7)",
                            color: hex ?? "#e4e4e7",
                            borderColor: hex ? `${hex}30` : "rgba(82,82,91,0.8)",
                          }
                        : undefined
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Status filter */}
            <div className="mt-1.5 flex gap-1">
              {STATUS_FILTERS.map(({ value, label }) => {
                const isActive = activeStatus === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveStatus(value)}
                    className={cn(
                      "rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-all",
                      isActive
                        ? value === "active"
                          ? STATUS_COLORS.active
                          : value === "draft"
                            ? STATUS_COLORS.draft
                            : value === "archived"
                              ? STATUS_COLORS.archived
                              : "border-zinc-600/60 bg-zinc-700/40 text-zinc-300"
                        : "border-transparent text-zinc-600 hover:border-zinc-700/60 hover:text-zinc-400",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="shrink-0 px-3 pb-2">
          <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2">
            <span className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-300">{docs.length}</span> docs ·{" "}
              <span className="font-medium text-emerald-400">{activeCount}</span> active
            </span>
            {docs.some((d) => d.metrics.feedback.length > 0) && (
              <span className="text-xs text-zinc-500">
                <span
                  className={cn(
                    "font-medium",
                    successPct >= 80
                      ? "text-emerald-400"
                      : successPct >= 50
                        ? "text-amber-400"
                        : "text-red-400",
                  )}
                >
                  {successPct}%
                </span>{" "}
                success
              </span>
            )}
          </div>
        </div>

        <div className="mx-3 border-t border-zinc-800/70" />

        {/* New Document button */}
        <div className="shrink-0 px-3 pt-3">
          <button
            type="button"
            onClick={() => openEditor()}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/30 px-3 py-2 text-xs font-medium text-zinc-400 transition-all hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-300"
          >
            <Plus size={13} />
            New Document
          </button>
        </div>

        {/* Doc list */}
        <div className="flex min-h-0 flex-1">
          <ScrollArea
            className="min-h-0 w-full flex-1"
            viewportClassName="overscroll-contain [&>div]:!block"
          >
            <div className="space-y-2 p-3">
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Brain size={28} className="mb-3 text-zinc-700" />
                  <p className="text-sm font-medium text-zinc-500">
                    {docs.length === 0 ? "No documents yet" : "No results found"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {docs.length === 0
                      ? "Create your first knowledge document above"
                      : "Try a different search or filter"}
                  </p>
                </div>
              )}

              {filtered.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onEdit={openEditor}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Doc Editor Sheet */}
      <DocEditor />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        tone="danger"
        title="Delete this document?"
        description={
          deleteTarget ? (
            <>
              <span className="font-medium text-zinc-200">&ldquo;{deleteTarget.title}&rdquo;</span>{" "}
              will be permanently removed. This action cannot be undone.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteDoc(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
}

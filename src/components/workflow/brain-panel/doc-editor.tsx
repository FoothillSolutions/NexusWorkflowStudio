"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { useKnowledgeStore } from "@/store/knowledge-store";
import { useSavedWorkflowsStore } from "@/store/library";
import type { KnowledgeDoc, KnowledgeDocType, KnowledgeDocStatus, FeedbackRating } from "@/types/knowledge";
import {
  DOC_TYPE_LABELS,
  DOC_TYPE_ACCENT_HEX,
  DOC_TYPE_ICONS,
  STATUS_LABELS,
  STATUS_COLORS,
  FEEDBACK_COLORS,
  formatTimeAgo,
} from "./constants";
import { Check, ThumbsDown, ThumbsUp, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DOC_TYPES: KnowledgeDocType[] = ["note", "summary", "runbook", "guide", "data"];
const DOC_STATUSES: KnowledgeDocStatus[] = ["draft", "active", "archived"];

function TagChips({
  tags,
  onRemove,
}: {
  tags: string[];
  onRemove: (t: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-300"
        >
          #{t}
          <button
            type="button"
            onClick={() => onRemove(t)}
            className="text-zinc-500 hover:text-zinc-200"
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * Outer wrapper: reads store state and renders Sheet.
 * Uses `key` on inner form to reset state when the edited doc changes,
 * avoiding setState-in-effect which the React compiler forbids.
 */
export function DocEditor() {
  const { editorOpen, editingDocId, docs, closeEditor, saveDoc, addFeedback } =
    useKnowledgeStore();
  const workflowEntries = useSavedWorkflowsStore((s) => s.entries);

  const existingDoc = editingDocId ? docs.find((d) => d.id === editingDocId) ?? null : null;

  const handleClose = () => {
    closeEditor();
  };

  return (
    <Sheet open={editorOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 border-l border-zinc-800 bg-zinc-950 p-0 sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-zinc-800/80 px-5 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-semibold text-zinc-100">
              {existingDoc ? "Edit Document" : "New Document"}
            </SheetTitle>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          </div>
        </SheetHeader>

        <DocEditorForm
          key={editingDocId ?? "__new__"}
          existingDoc={existingDoc}
          editingDocId={editingDocId}
          workflowEntries={workflowEntries}
          onSave={saveDoc}
          onAddFeedback={addFeedback}
          onClose={handleClose}
        />
      </SheetContent>
    </Sheet>
  );
}

interface DocEditorFormProps {
  existingDoc: KnowledgeDoc | null;
  editingDocId: string | null;
  workflowEntries: { id: string; name: string; nodeCount: number }[];
  onSave: (data: {
    id?: string;
    title: string;
    summary: string;
    content: string;
    docType: KnowledgeDocType;
    status: KnowledgeDocStatus;
    createdBy: string;
    tags: string[];
    associatedWorkflowIds: string[];
  }) => void;
  onAddFeedback: (docId: string, rating: FeedbackRating, note: string, author: string) => void;
  onClose: () => void;
}

function DocEditorForm({
  existingDoc,
  editingDocId,
  workflowEntries,
  onSave,
  onAddFeedback,
  onClose,
}: DocEditorFormProps) {
  // Initial state derived from existingDoc (set once via key-based remount)
  const [title, setTitle] = useState(existingDoc?.title ?? "");
  const [summary, setSummary] = useState(existingDoc?.summary ?? "");
  const [content, setContent] = useState(existingDoc?.content ?? "");
  const [docType, setDocType] = useState<KnowledgeDocType>(existingDoc?.docType ?? "note");
  const [status, setStatus] = useState<KnowledgeDocStatus>(existingDoc?.status ?? "draft");
  const [createdBy, setCreatedBy] = useState(existingDoc?.createdBy ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(existingDoc?.tags ? [...existingDoc.tags] : []);
  const [associatedWorkflowIds, setAssociatedWorkflowIds] = useState<string[]>(
    existingDoc?.associatedWorkflowIds ? [...existingDoc.associatedWorkflowIds] : [],
  );

  // Feedback form
  const [fbRating, setFbRating] = useState<FeedbackRating>("neutral");
  const [fbNote, setFbNote] = useState("");
  const [fbAuthor, setFbAuthor] = useState("");
  const [fbSubmitting, setFbSubmitting] = useState(false);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: existingDoc?.id,
      title: title.trim(),
      summary: summary.trim(),
      content,
      docType,
      status,
      createdBy: createdBy.trim(),
      tags,
      associatedWorkflowIds,
    });
    onClose();
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const t = tagInput.trim().replace(/^#/, "");
      if (t && !tags.includes(t)) setTags([...tags, t]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const toggleWorkflow = (id: string) => {
    setAssociatedWorkflowIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmitFeedback = () => {
    if (!editingDocId || !fbNote.trim() || !fbAuthor.trim()) return;
    setFbSubmitting(true);
    onAddFeedback(editingDocId, fbRating, fbNote.trim(), fbAuthor.trim());
    setFbNote("");
    setFbAuthor("");
    setFbRating("neutral");
    setFbSubmitting(false);
  };

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-400">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title..."
              className="border-zinc-700/60 bg-zinc-900/60 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-400">Summary</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short one-liner shown in card view..."
              rows={2}
              className="resize-none border-zinc-700/60 bg-zinc-900/60 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
            />
          </div>

          {/* DocType */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-400">Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {DOC_TYPES.map((t) => {
                const Icon = DOC_TYPE_ICONS[t];
                const hex = DOC_TYPE_ACCENT_HEX[t];
                const isActive = docType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDocType(t)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                      isActive
                        ? "shadow-sm"
                        : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                    )}
                    style={
                      isActive
                        ? {
                            backgroundColor: `${hex}18`,
                            borderColor: `${hex}40`,
                            color: hex,
                          }
                        : undefined
                    }
                  >
                    <Icon size={12} />
                    {DOC_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status + CreatedBy row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-400">Status</Label>
              <div className="flex flex-col gap-1">
                {DOC_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                      status === s
                        ? STATUS_COLORS[s]
                        : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                    )}
                  >
                    {status === s && <Check size={10} />}
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-400">Author</Label>
              <Input
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder="Your name..."
                className="border-zinc-700/60 bg-zinc-900/60 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-400">
              Tags{" "}
              <span className="text-zinc-600">(press Enter or comma to add)</span>
            </Label>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="#tag1, #tag2..."
              className="border-zinc-700/60 bg-zinc-900/60 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
            />
            <TagChips tags={tags} onRemove={handleRemoveTag} />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-400">Content</Label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              height={280}
              placeholder="Write your document content in Markdown..."
              hideToolbar={false}
            />
          </div>

          {/* Associated Workflows */}
          {workflowEntries.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-400">
                Associated Workflows
              </Label>
              <div className="space-y-1 rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-2">
                {workflowEntries.map((entry) => {
                  const checked = associatedWorkflowIds.includes(entry.id);
                  return (
                    <label
                      key={entry.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWorkflow(entry.id)}
                        className="accent-sky-400"
                      />
                      <span className="text-xs text-zinc-300">{entry.name}</span>
                      <span className="ml-auto text-[10px] text-zinc-600">
                        {entry.nodeCount} nodes
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metrics (existing doc only) */}
          {existingDoc && (
            <div className="space-y-3 rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Usage Metrics
                </span>
                <span className="text-xs text-zinc-500">
                  {existingDoc.metrics.views} view
                  {existingDoc.metrics.views !== 1 ? "s" : ""}
                  {existingDoc.metrics.lastViewedAt &&
                    ` · last ${formatTimeAgo(existingDoc.metrics.lastViewedAt)}`}
                </span>
              </div>

              {existingDoc.metrics.feedback.length > 0 && (
                <div className="space-y-1.5">
                  {existingDoc.metrics.feedback.map((fb) => (
                    <div
                      key={fb.id}
                      className="flex items-start gap-2 rounded-lg bg-zinc-800/30 px-2.5 py-1.5"
                    >
                      <span className={cn("mt-0.5 text-xs font-bold", FEEDBACK_COLORS[fb.rating])}>
                        {fb.rating === "success" ? "✓" : fb.rating === "failure" ? "✗" : "–"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-300">{fb.note}</p>
                        <p className="text-[10px] text-zinc-600">
                          {fb.author} · {formatTimeAgo(fb.at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add feedback */}
              <div className="space-y-2 border-t border-zinc-800/60 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Add Feedback
                </p>
                <div className="flex gap-1.5">
                  {(["success", "neutral", "failure"] as FeedbackRating[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFbRating(r)}
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all",
                        fbRating === r
                          ? r === "success"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : r === "failure"
                              ? "border-red-500/40 bg-red-500/15 text-red-300"
                              : "border-zinc-600/60 bg-zinc-700/40 text-zinc-300"
                          : "border-zinc-700/60 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300",
                      )}
                    >
                      {r === "success" ? (
                        <ThumbsUp size={11} />
                      ) : r === "failure" ? (
                        <ThumbsDown size={11} />
                      ) : (
                        <Minus size={11} />
                      )}
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
                <Input
                  value={fbNote}
                  onChange={(e) => setFbNote(e.target.value)}
                  placeholder="Note (required)..."
                  className="border-zinc-700/60 bg-zinc-900/60 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
                />
                <Input
                  value={fbAuthor}
                  onChange={(e) => setFbAuthor(e.target.value)}
                  placeholder="Your name (required)..."
                  className="border-zinc-700/60 bg-zinc-900/60 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSubmitFeedback}
                  disabled={fbSubmitting || !fbNote.trim() || !fbAuthor.trim()}
                  className="h-8 rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 text-xs text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                >
                  Submit Feedback
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 border-t border-zinc-800/80 px-5 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 rounded-lg border border-zinc-700/60 px-3 text-xs text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!title.trim()}
            className="h-8 rounded-lg bg-sky-600 px-3 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {existingDoc ? "Save Changes" : "Create Document"}
          </Button>
        </div>
      </div>
    </>
  );
}

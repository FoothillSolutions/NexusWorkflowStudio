"use client";

import type React from "react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Brain, ExternalLink, FileUp, Maximize2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileTypeSelect } from "@/nodes/shared/file-type-select";
import type { FormControl } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { useKnowledgeStore } from "@/store/knowledge-store";
import { useSavedWorkflowsStore } from "@/store/library";
import { cn } from "@/lib/utils";

interface DocumentContentSectionProps {
  control: FormControl;
  contentMode: string;
  contentText: string;
  linkedFileName: string | null;
  brainDocId: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenEditor: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearLinkedFile: () => void;
  onSetValue: (name: string, value: unknown, options?: { shouldDirty: boolean }) => void;
}

function BrainDocPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const docs = useKnowledgeStore((s) => s.docs);
  const [search, setSearch] = useState("");

  const filtered = docs.filter(
    (d) =>
      d.status !== "archived" &&
      (search === "" ||
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))),
  );

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/30 px-4 py-6 text-center">
        <Brain size={20} className="text-zinc-600" />
        <p className="text-xs text-zinc-500">No Brain documents yet</p>
        <p className="text-[10px] text-zinc-600">
          Create documents in the Brain panel first
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          type="text"
          placeholder="Search brain docs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-full rounded-lg border border-zinc-700/50 bg-zinc-900/60 pl-8 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-zinc-600"
        />
      </div>

      <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-1.5">
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-zinc-600">
            No results
          </p>
        )}
        {filtered.map((doc) => {
          const isSelected = doc.id === selectedId;
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => onSelect(doc.id)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                isSelected
                  ? "border border-sky-500/30 bg-sky-500/10"
                  : "border border-transparent hover:bg-zinc-800/60",
              )}
            >
              <Brain
                size={14}
                className={cn(
                  "mt-0.5 shrink-0",
                  isSelected ? "text-sky-400" : "text-zinc-500",
                )}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-xs font-medium",
                    isSelected ? "text-sky-200" : "text-zinc-200",
                  )}
                >
                  {doc.title}
                </p>
                {doc.summary && (
                  <p className="truncate text-[10px] text-zinc-500">
                    {doc.summary}
                  </p>
                )}
                {doc.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {doc.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-zinc-800/70 px-1.5 py-0.5 text-[9px] text-zinc-500"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {isSelected && (
                <span className="mt-0.5 shrink-0 text-sky-400">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DocumentContentSection({
  control,
  contentMode,
  contentText,
  linkedFileName,
  brainDocId,
  fileInputRef,
  onOpenEditor,
  onFileUpload,
  onClearLinkedFile,
  onSetValue,
}: DocumentContentSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="file-ext">File Type</Label>
        <Controller
          name={"fileExtension" as never}
          control={control}
          render={({ field }) => (
            <FileTypeSelect
              value={(field.value as string) ?? "md"}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Content Source</Label>
        <Controller
          name={"contentMode" as never}
          control={control}
          render={({ field }) => (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  field.onChange("inline");
                  onSetValue("brainDocId", null, { shouldDirty: true });
                }}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                  (field.value as string) === "inline"
                    ? "border-yellow-700/60 bg-yellow-950/50 text-yellow-300"
                    : "border-zinc-700/40 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                ✏️ Inline Content
              </button>
              <button
                type="button"
                onClick={() => {
                  field.onChange("linked");
                  onSetValue("brainDocId", null, { shouldDirty: true });
                }}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                  (field.value as string) === "linked"
                    ? "border-yellow-700/60 bg-yellow-950/50 text-yellow-300"
                    : "border-zinc-700/40 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                📎 Linked File
              </button>
              <button
                type="button"
                onClick={() => {
                  field.onChange("brain");
                  onSetValue("brainDocId", null, { shouldDirty: true });
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all",
                  (field.value as string) === "brain"
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                    : "border-zinc-700/40 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300",
                )}
              >
                <Brain size={12} />
                Brain
              </button>
            </div>
          )}
        />
      </div>

      {contentMode === "inline" && (
        <div className="space-y-2">
          <Label>
            Content <RequiredIndicator />
          </Label>
          {contentText ? (
            <div
              className="cursor-pointer rounded-xl border border-zinc-700/40 bg-zinc-800/40 px-3 py-2 transition-colors hover:border-yellow-700/50"
              onClick={onOpenEditor}
              title="Click to edit content"
            >
              <pre className="line-clamp-4 max-h-20 overflow-hidden whitespace-pre-wrap wrap-break-word font-mono text-xs text-zinc-400">
                {contentText}
              </pre>
            </div>
          ) : (
            <p className="px-1 text-xs italic text-zinc-600">No content yet</p>
          )}

          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full gap-2 rounded-xl border border-dashed border-zinc-700/60 text-xs text-zinc-400 transition-all hover:border-yellow-700/60 hover:text-yellow-400"
            onClick={onOpenEditor}
          >
            <Maximize2 size={14} />
            {contentText ? "Edit Content" : "Add Content"}
          </Button>
        </div>
      )}

      {contentMode === "linked" && (
        <div className="space-y-2">
          <Label>Upload File</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.json,.yaml,.yml"
            onChange={onFileUpload}
            className="hidden"
          />
          {linkedFileName ? (
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-yellow-800/30 bg-yellow-950/30 px-3 py-2">
              <FileUp size={14} className="shrink-0 text-yellow-500" />
              <span
                className="min-w-0 flex-1 truncate font-mono text-sm text-yellow-300"
                title={linkedFileName}
              >
                {linkedFileName}
              </span>
              <button
                type="button"
                onClick={onClearLinkedFile}
                className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-red-950/30 hover:text-red-400"
                title="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-full flex-col gap-1 rounded-xl border-2 border-dashed border-zinc-700/60 text-zinc-500 transition-all hover:border-yellow-700/60 hover:text-yellow-400"
            >
              <FileUp size={20} />
              <span className="text-xs">
                Click to upload .md, .txt, .json, or .yaml
              </span>
            </Button>
          )}
        </div>
      )}

      {contentMode === "brain" && (
        <div className="space-y-2">
          <BrainDocPicker
            selectedId={brainDocId ?? null}
            onSelect={(id) => {
              onSetValue("brainDocId", id, { shouldDirty: true });
              // Backlink: add this workflow to brain doc's associatedWorkflowIds
              const workflowId = useSavedWorkflowsStore.getState().activeId;
              if (workflowId) {
                const doc = useKnowledgeStore.getState().docs.find((d) => d.id === id);
                if (doc && !doc.associatedWorkflowIds.includes(workflowId)) {
                  useKnowledgeStore.getState().saveDoc({
                    ...doc,
                    associatedWorkflowIds: [...doc.associatedWorkflowIds, workflowId],
                  });
                }
              }
            }}
          />
          {brainDocId && (
            <button
              type="button"
              onClick={() => useKnowledgeStore.getState().openPanel()}
              className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-sky-400"
            >
              <ExternalLink size={10} />
              Open in Brain panel
            </button>
          )}
        </div>
      )}
    </>
  );
}



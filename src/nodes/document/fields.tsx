"use client";
import { useState, useCallback, useRef } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FullscreenMarkdownEditor } from "@/components/ui/fullscreen-markdown-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileUp, X, Maximize2, Check } from "lucide-react";
import { toast } from "sonner";
import type { FormControl, FormSetValue, FormRegister } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { FileTypeSelect } from "@/nodes/shared/file-type-select";

const DOC_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ALLOWED_EXTENSIONS = ["md", "txt", "json", "yaml", "yml"] as const;


interface DocumentFieldsProps {
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
}

/* ── Plain-text fullscreen editor for non-markdown file types ──────────── */

function PlainTextEditorDialog({
  open,
  onOpenChange,
  value,
  onSave,
  fileExtension,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (value: string) => void;
  fileExtension: string;
}) {
  const [draft, setDraft] = useState(value);
  const prevOpenRef = useRef(open);

  // Sync draft when dialog opens (transition from closed → open)
  if (open && !prevOpenRef.current) {
    setDraft(value);
  }
  prevOpenRef.current = open;

  const handleSave = useCallback(() => {
    onSave(draft);
    onOpenChange(false);
  }, [draft, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[80vw] !w-[80vw] !max-h-[80vh] !h-[80vh] bg-zinc-900 border-zinc-700/50 flex flex-col gap-0 p-0 rounded-2xl">
        <DialogHeader className="px-5 py-4 border-b border-zinc-700/50 shrink-0">
          <DialogTitle className="text-sm font-medium text-zinc-100">
            Edit {fileExtension.toUpperCase()} Content
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 p-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Enter ${fileExtension.toUpperCase()} content...`}
            className="w-full h-full bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 resize-none text-sm font-mono"
          />
        </div>
        <DialogFooter className="px-5 py-3 border-t border-zinc-700/50 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5 rounded-xl">
            <Check size={14} />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Fields({ control, setValue }: DocumentFieldsProps) {
  const docName: string = useWatch({ control, name: "docName" }) ?? "";
  const contentMode: string = useWatch({ control, name: "contentMode" }) ?? "inline";
  const fileExtension: string = useWatch({ control, name: "fileExtension" }) ?? "md";
  const contentText: string = useWatch({ control, name: "contentText" }) ?? "";
  const linkedFileName: string = useWatch({ control, name: "linkedFileName" }) ?? "";

  const [editorOpen, setEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidDocName = !docName || DOC_NAME_REGEX.test(docName);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const normalizedExt = ext === "yml" ? "yaml" : ext;

      if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
        toast.error(`Unsupported file type: .${ext}. Use .md, .txt, .json, or .yaml`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setValue("linkedFileName" as never, file.name as never, { shouldDirty: true });
        setValue("linkedFileContent" as never, text as never, { shouldDirty: true });
        setValue("fileExtension" as never, normalizedExt as never, { shouldDirty: true });
        toast.success(`Loaded ${file.name}`);
      };
      reader.onerror = () => toast.error("Failed to read file");
      reader.readAsText(file);

      // Reset so the same file can be re-uploaded
      e.target.value = "";
    },
    [setValue]
  );

  const clearLinkedFile = useCallback(() => {
    setValue("linkedFileName" as never, "" as never, { shouldDirty: true });
    setValue("linkedFileContent" as never, "" as never, { shouldDirty: true });
  }, [setValue]);

  const handleEditorSave = useCallback(
    (val: string) => {
      setValue("contentText" as never, val as never, { shouldDirty: true });
    },
    [setValue]
  );

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Document Name */}
      <div className="space-y-2">
        <Label htmlFor="doc-name">
          Document Name <RequiredIndicator />
        </Label>
        <p className="text-[10px] text-zinc-600">
          Lowercase letters, digits, single hyphens. E.g. <code className="font-mono text-yellow-400">api-guide</code>
        </p>
        <Controller
          name={"docName" as never}
          control={control}
          render={({ field }) => (
            <Input
              id="doc-name"
              placeholder="my-doc-name"
              className={`bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-sm ${!isValidDocName ? "border-red-600/60" : ""}`}
              value={(field.value as string) ?? ""}
              onChange={(e) => {
                // Only allow valid characters while typing
                const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                field.onChange(v);
              }}
            />
          )}
        />
        {!isValidDocName && (
          <p className="text-[10px] text-red-400 mt-0.5 px-1">
            Must be lowercase, digits, single non-leading/trailing hyphens
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="doc-description">Description</Label>
        <Controller
          name={"description" as never}
          control={control}
          render={({ field }) => (
            <Textarea
              id="doc-description"
              placeholder="Describe what this document provides"
              className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 min-h-[72px] resize-none text-sm"
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {/* File Extension */}
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

      {/* Content Mode Toggle */}
      <div className="space-y-2">
        <Label>Content Source</Label>
        <Controller
          name={"contentMode" as never}
          control={control}
          render={({ field }) => (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => field.onChange("inline")}
                className={`flex-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  (field.value as string) === "inline"
                    ? "bg-yellow-950/50 border-yellow-700/60 text-yellow-300"
                    : "bg-zinc-800/40 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                ✏️ Inline Content
              </button>
              <button
                type="button"
                onClick={() => field.onChange("linked")}
                className={`flex-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  (field.value as string) === "linked"
                    ? "bg-yellow-950/50 border-yellow-700/60 text-yellow-300"
                    : "bg-zinc-800/40 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                📎 Linked File
              </button>
            </div>
          )}
        />
      </div>

      {/* Inline Content — compact preview + edit button */}
      {contentMode === "inline" && (
        <div className="space-y-2">
          <Label>
            Content <RequiredIndicator />
          </Label>

          {/* Preview snippet */}
          {contentText ? (
            <div
              className="px-3 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/40 cursor-pointer hover:border-yellow-700/50 transition-colors"
              onClick={() => setEditorOpen(true)}
              title="Click to edit content"
            >
              <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-words line-clamp-4 max-h-[5rem] overflow-hidden">
                {contentText}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 italic px-1">No content yet</p>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full gap-2 rounded-xl border border-dashed border-zinc-700/60 hover:border-yellow-700/60 text-zinc-400 hover:text-yellow-400 transition-all h-9 text-xs"
            onClick={() => setEditorOpen(true)}
          >
            <Maximize2 size={14} />
            {contentText ? "Edit Content" : "Add Content"}
          </Button>
        </div>
      )}

      {/* Fullscreen Content Editor Dialog */}
      {contentMode === "inline" && fileExtension === "md" && (
        <FullscreenMarkdownEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          value={contentText}
          onSave={handleEditorSave}
        />
      )}

      {/* Fullscreen plain-text editor for non-markdown */}
      {contentMode === "inline" && fileExtension !== "md" && editorOpen && (
        <PlainTextEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          value={contentText}
          onSave={handleEditorSave}
          fileExtension={fileExtension}
        />
      )}

      {/* Linked File Upload */}
      {contentMode === "linked" && (
        <div className="space-y-2">
          <Label>Upload File</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.json,.yaml,.yml"
            onChange={handleFileUpload}
            className="hidden"
          />
          {linkedFileName ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-950/30 border border-yellow-800/30 min-w-0">
              <FileUp size={14} className="text-yellow-500 shrink-0" />
              <span className="text-sm font-mono text-yellow-300 truncate flex-1 min-w-0" title={linkedFileName}>{linkedFileName}</span>
              <button
                type="button"
                onClick={clearLinkedFile}
                className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0"
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
              className="w-full h-20 rounded-xl border-2 border-dashed border-zinc-700/60 hover:border-yellow-700/60 text-zinc-500 hover:text-yellow-400 transition-all flex flex-col gap-1"
            >
              <FileUp size={20} />
              <span className="text-xs">Click to upload .md, .txt, .json, or .yaml</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}


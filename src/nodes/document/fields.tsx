"use client";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
import { FileUp, X, Maximize2, Check, ChevronDown, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import type { FormControl, FormSetValue, FormRegister } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { FileTypeSelect } from "@/nodes/shared/file-type-select";
import { useWorkflowStore } from "@/store/workflow-store";
import { cn } from "@/lib/utils";
import {
  DOC_NAME_REGEX,
  DOC_SUBFOLDER_REGEX,
  collectDocumentSubfolders,
  getDocumentDisplayPath,
  normalizeDocSubfolder,
} from "./utils";

const ALLOWED_EXTENSIONS = ["md", "txt", "json", "yaml", "yml"] as const;


interface DocumentFieldsProps {
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
}

function DocumentSubfolderSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selectedLabel = value ? value : "Root docs folder";
  const selectedPath = value ? `docs/${value}/` : "docs/";

  return (
    <div ref={containerRef} className="relative">
      <button
        id="doc-subfolder"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left",
          "bg-zinc-900/70 border border-zinc-700/60 shadow-sm shadow-black/20",
          "transition-all duration-150 hover:bg-zinc-900 hover:border-zinc-600/70",
          "focus:outline-none focus:ring-1 focus:ring-yellow-500/40",
          open && "border-yellow-500/40 bg-zinc-900",
        )}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/15 shrink-0">
          <FolderOpen size={16} className="text-yellow-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-100">{selectedLabel}</div>
          <div className="truncate text-[11px] font-mono text-zinc-500">{selectedPath}</div>
        </div>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-zinc-500 transition-transform duration-150", open && "rotate-180 text-yellow-400")}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-950/95 backdrop-blur-xl shadow-2xl shadow-black/50">
          <div className="border-b border-zinc-800 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Select docs folder
          </div>
          <div className="max-h-56 overflow-y-auto py-1.5">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                value === "" ? "bg-yellow-500/10 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800/80 shrink-0">
                {value === "" ? <Check size={13} className="text-yellow-400" /> : <FolderOpen size={13} className="text-zinc-500" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">Root docs folder</span>
                <span className="block truncate text-[11px] font-mono text-zinc-500">docs/</span>
              </span>
            </button>

            {options.map((folder) => {
              const isSelected = value === folder;
              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => {
                    onChange(folder);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    isSelected ? "bg-yellow-500/10 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800/80 shrink-0">
                    {isSelected ? <Check size={13} className="text-yellow-400" /> : <FolderOpen size={13} className="text-yellow-500" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{folder}</span>
                    <span className="block truncate text-[11px] font-mono text-zinc-500">docs/{folder}/</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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

  // Wrap onOpenChange to sync draft when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraft(value);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, value]
  );

  const handleSave = useCallback(() => {
    onSave(draft);
    onOpenChange(false);
  }, [draft, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
  const docSubfolder: string = useWatch({ control, name: "docSubfolder" }) ?? "";
  const contentMode: string = useWatch({ control, name: "contentMode" }) ?? "inline";
  const fileExtension: string = useWatch({ control, name: "fileExtension" }) ?? "md";
  const contentText: string = useWatch({ control, name: "contentText" }) ?? "";
  const linkedFileName: string = useWatch({ control, name: "linkedFileName" }) ?? "";

  const [editorOpen, setEditorOpen] = useState(false);
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [newSubfolder, setNewSubfolder] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workflowNodes = useWorkflowStore((s) => s.nodes);
  const activeSubWorkflowNodes = useWorkflowStore((s) => s.subWorkflowNodes);

  const isValidDocName = !docName || DOC_NAME_REGEX.test(docName);
  const sharedSubfolders = useMemo(() => {
    const folders = new Set<string>(collectDocumentSubfolders(workflowNodes));
    for (const folder of collectDocumentSubfolders(activeSubWorkflowNodes)) {
      folders.add(folder);
    }
    return [...folders].sort((a, b) => a.localeCompare(b));
  }, [activeSubWorkflowNodes, workflowNodes]);
  const subfolderOptions = useMemo(() => {
    const folders = new Set(sharedSubfolders);
    if (docSubfolder.trim()) folders.add(docSubfolder.trim());
    return [...folders].sort((a, b) => a.localeCompare(b));
  }, [docSubfolder, sharedSubfolders]);
  const outputPathPreview = useMemo(
    () => `docs/${getDocumentDisplayPath({ docName, docSubfolder, fileExtension: fileExtension as "md" | "txt" | "json" | "yaml" })}`,
    [docName, docSubfolder, fileExtension],
  );

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

  const handleCreateSubfolder = useCallback(() => {
    const normalized = normalizeDocSubfolder(newSubfolder);
    if (!normalized) {
      toast.error("Enter a subfolder name first");
      return;
    }
    if (!DOC_SUBFOLDER_REGEX.test(normalized)) {
      toast.error("Subfolder must use lowercase letters, digits, and single hyphens only");
      return;
    }

    setValue("docSubfolder" as never, normalized as never, { shouldDirty: true });
    setNewSubfolder("");
    setIsCreatingSubfolder(false);
    toast.success(`Selected docs/${normalized}`);
  }, [newSubfolder, setValue]);

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

      {/* Shared Subfolder */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="doc-subfolder">Docs Subfolder</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 rounded-lg text-[11px] text-zinc-400 hover:text-yellow-300"
            onClick={() => {
              setIsCreatingSubfolder((prev) => !prev);
              setNewSubfolder(docSubfolder);
            }}
          >
            {isCreatingSubfolder ? "Cancel" : "Create new"}
          </Button>
        </div>

        <Controller
          name={"docSubfolder" as never}
          control={control}
          render={({ field }) => (
            <div className="px-0.5 py-0.5">
              <DocumentSubfolderSelect
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                options={subfolderOptions}
              />
            </div>
          )}
        />

        {isCreatingSubfolder && (
          <div className="rounded-2xl border border-yellow-500/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-yellow-950/10 p-3 space-y-2 shadow-sm shadow-black/20">
            <Input
              value={newSubfolder}
              onChange={(e) => setNewSubfolder(normalizeDocSubfolder(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateSubfolder();
                }
              }}
              placeholder="team-guides"
              className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-sm"
            />
            <p className="text-[10px] text-zinc-500">
              Use lowercase letters, digits, and hyphens. Example: <code className="font-mono text-yellow-400">team-guides</code>
            </p>
            <div className="flex justify-end">
              <Button type="button" size="sm" className="rounded-xl" onClick={handleCreateSubfolder}>
                Save subfolder
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Generated path</div>
          <code className="mt-1 block font-mono text-[12px] text-yellow-400 break-all">{outputPathPreview}</code>
        </div>
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


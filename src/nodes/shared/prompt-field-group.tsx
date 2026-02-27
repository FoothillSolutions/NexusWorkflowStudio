"use client";
import { useState, useCallback, useRef } from "react";
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { FullscreenMarkdownEditor } from "@/components/ui/fullscreen-markdown-editor";
import { Maximize2, FileUp } from "lucide-react";
import { toast } from "sonner";
import type { FormControl, FormSetValue } from "./form-types";

/** Strip YAML frontmatter (enclosed by --- at the top of a file) */
function stripFrontmatter(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, ""); // strip BOM
  if (!trimmed.startsWith("---")) return trimmed;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return trimmed;
  return trimmed.slice(end + 4).replace(/^\n+/, "");
}

interface PromptFieldGroupProps {
  /** react-hook-form control */
  control: FormControl;
  /** react-hook-form setValue */
  setValue: FormSetValue;
  /** The form field name that holds the prompt text (defaults to "promptText") */
  fieldName?: string;
  /** Current prompt text value (watched externally) */
  value: string;
  /** Label displayed above the editor */
  label?: string;
  /** Height of the inline MarkdownEditor */
  height?: number;
  /** Placeholder for the inline MarkdownEditor */
  placeholder?: string;
  /** HTML id for the label / editor (accessibility) */
  htmlId?: string;
}

/**
 * Reusable prompt field group with:
 * - Inline MarkdownEditor
 * - "Load File" button (loads .md/.txt, strips YAML frontmatter)
 * - "Editor" button (opens fullscreen markdown editor dialog)
 */
export function PromptFieldGroup({
  control,
  setValue,
  fieldName = "promptText",
  value,
  label = "Prompt",
  height = 200,
  placeholder = "Write your prompt in Markdown…",
  htmlId = "promptText",
}: PromptFieldGroupProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEditorSave = useCallback(
    (val: string) => {
      setValue(fieldName as never, val as never, { shouldDirty: true });
    },
    [setValue, fieldName]
  );

  const handleFileLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result as string;
        const cleaned = stripFrontmatter(raw);
        setValue(fieldName as never, cleaned as never, { shouldDirty: true });
        toast.success(`Loaded "${file.name}"`, {
          description: "YAML frontmatter removed (if any).",
        });
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [setValue, fieldName]
  );

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={htmlId}>{label}</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-100"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={13} />
              Load File
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-100"
              onClick={() => setEditorOpen(true)}
            >
              <Maximize2 size={13} />
              Editor
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.markdown"
          className="hidden"
          onChange={handleFileLoad}
        />

        <Controller
          name={fieldName as never}
          control={control}
          render={({ field }) => (
            <MarkdownEditor
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              height={height}
              placeholder={placeholder}
              hideToolbar
            />
          )}
        />
      </div>

      {/* Fullscreen Editor Dialog */}
      <FullscreenMarkdownEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        value={value}
        onSave={handleEditorSave}
      />
    </>
  );
}


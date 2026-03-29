"use client";

import { useState, useCallback, useRef } from "react";
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { FullscreenCodeEditor } from "@/components/ui/fullscreen-code-editor";
import { Maximize2, FileUp } from "lucide-react";
import { toast } from "sonner";
import type { FormControl, FormSetValue } from "./form-types";
import { RequiredIndicator } from "./required-indicator";

interface CodeFieldGroupProps {
  control: FormControl;
  setValue: FormSetValue;
  fieldName?: string;
  value: string;
  label?: string;
  height?: number;
  placeholder?: string;
  htmlId?: string;
  required?: boolean;
  language?: string;
  accept?: string;
  editorTitle?: string;
}

export function CodeFieldGroup({
  control,
  setValue,
  fieldName = "promptText",
  value,
  label = "Code",
  height = 220,
  placeholder = "Write code…",
  htmlId = "promptText",
  required = false,
  language = "typescript",
  accept = ".ts,.tsx,.js,.jsx,.mjs,.cjs,.txt",
  editorTitle = "Code Editor",
}: CodeFieldGroupProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEditorSave = useCallback(
    (nextValue: string) => {
      setValue(fieldName as never, nextValue as never, { shouldDirty: true });
    },
    [fieldName, setValue],
  );

  const handleFileLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result as string;
        setValue(fieldName as never, raw as never, { shouldDirty: true });
        toast.success(`Loaded "${file.name}"`);
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [fieldName, setValue],
  );

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={htmlId}>
            {label} {required && <RequiredIndicator />}
          </Label>
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

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileLoad}
        />

        <Controller
          name={fieldName as never}
          control={control}
          render={({ field }) => (
            <CodeEditor
              id={htmlId}
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              height={height}
              placeholder={placeholder}
              language={language}
            />
          )}
        />
      </div>

      <FullscreenCodeEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        value={value}
        onSave={handleEditorSave}
        language={language}
        title={editorTitle}
        placeholder={placeholder}
      />
    </>
  );
}


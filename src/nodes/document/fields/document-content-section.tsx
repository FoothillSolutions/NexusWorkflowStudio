"use client";

import type React from "react";
import { Controller } from "react-hook-form";
import { FileUp, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileTypeSelect } from "@/nodes/shared/file-type-select";
import type { FormControl } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";

interface DocumentContentSectionProps {
  control: FormControl;
  contentMode: string;
  contentText: string;
  linkedFileName: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenEditor: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearLinkedFile: () => void;
}

export function DocumentContentSection({
  control,
  contentMode,
  contentText,
  linkedFileName,
  fileInputRef,
  onOpenEditor,
  onFileUpload,
  onClearLinkedFile,
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
                onClick={() => field.onChange("inline")}
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
                onClick={() => field.onChange("linked")}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                  (field.value as string) === "linked"
                    ? "border-yellow-700/60 bg-yellow-950/50 text-yellow-300"
                    : "border-zinc-700/40 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                📎 Linked File
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
    </>
  );
}



"use client";

import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormControl } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { DocumentSubfolderSelect } from "./document-subfolder-select";

interface DocumentIdentitySectionProps {
  control: FormControl;
  isValidDocName: boolean;
  subfolderOptions: string[];
  isCreatingSubfolder: boolean;
  newSubfolder: string;
  outputPathPreview: string;
  onToggleCreateSubfolder: () => void;
  onNewSubfolderChange: (value: string) => void;
  onNewSubfolderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onCreateSubfolder: () => void;
}

export function DocumentIdentitySection({
  control,
  isValidDocName,
  subfolderOptions,
  isCreatingSubfolder,
  newSubfolder,
  outputPathPreview,
  onToggleCreateSubfolder,
  onNewSubfolderChange,
  onNewSubfolderKeyDown,
  onCreateSubfolder,
}: DocumentIdentitySectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="doc-name">
          Document Name <RequiredIndicator />
        </Label>
        <p className="text-[10px] text-zinc-600">
          Lowercase letters, digits, single hyphens. E.g.{" "}
          <code className="font-mono text-yellow-400">api-guide</code>
        </p>
        <Controller
          name={"docName" as never}
          control={control}
          render={({ field }) => (
            <Input
              id="doc-name"
              placeholder="my-doc-name"
              className={`rounded-xl border-zinc-700/60 bg-zinc-800/60 font-mono text-sm focus-visible:ring-zinc-600 ${!isValidDocName ? "border-red-600/60" : ""}`}
              value={(field.value as string) ?? ""}
              onChange={(event) => {
                const value = event.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "");
                field.onChange(value);
              }}
            />
          )}
        />
        {!isValidDocName && (
          <p className="mt-0.5 px-1 text-[10px] text-red-400">
            Must be lowercase, digits, single non-leading/trailing hyphens
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="doc-subfolder">Docs Subfolder</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-lg px-2 text-[11px] text-zinc-400 hover:text-yellow-300"
            onClick={onToggleCreateSubfolder}
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
          <div className="space-y-2 rounded-2xl border border-yellow-500/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-yellow-950/10 p-3 shadow-sm shadow-black/20">
            <Input
              value={newSubfolder}
              onChange={(event) => onNewSubfolderChange(event.target.value)}
              onKeyDown={onNewSubfolderKeyDown}
              placeholder="team-guides"
              className="rounded-xl border-zinc-700/60 bg-zinc-800/60 font-mono text-sm focus-visible:ring-zinc-600"
            />
            <p className="text-[10px] text-zinc-500">
              Use lowercase letters, digits, and hyphens. Example:{" "}
              <code className="font-mono text-yellow-400">team-guides</code>
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={onCreateSubfolder}
              >
                Save subfolder
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            Generated path
          </div>
          <code className="mt-1 block break-all font-mono text-[12px] text-yellow-400">
            {outputPathPreview}
          </code>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc-description">Description</Label>
        <Controller
          name={"description" as never}
          control={control}
          render={({ field }) => (
            <Textarea
              id="doc-description"
              placeholder="Describe what this document provides"
              className="min-h-18 resize-none rounded-xl border-zinc-700/60 bg-zinc-800/60 text-sm focus-visible:ring-zinc-600"
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  );
}




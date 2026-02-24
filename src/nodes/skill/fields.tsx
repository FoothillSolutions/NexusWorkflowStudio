"use client";
import { useEffect } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Plus, Trash2 } from "lucide-react";
import { detectVariables, DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue, FormRegister } from "@/nodes/shared/form-types";
import type { SkillMetadataEntry } from "./types";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isValidSlug = (v: string) => { const t = v.trim(); return t === "" || SLUG_REGEX.test(t); };

interface SkillFieldsProps {
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
}

export function Fields({ control, setValue }: SkillFieldsProps) {
  const promptText: string = useWatch({ control, name: "promptText" }) ?? "";
  const metadata: SkillMetadataEntry[] = useWatch({ control, name: "metadata" }) ?? [];

  const { dynamic, static: staticVars } = detectVariables(promptText);

  useEffect(() => {
    setValue("detectedVariables" as never, [...dynamic, ...staticVars] as never, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText]);

  const addEntry = () =>
    setValue("metadata" as never, [...metadata, { key: "", value: "" }] as never, { shouldDirty: true });

  const removeEntry = (i: number) =>
    setValue("metadata" as never, metadata.filter((_, idx) => idx !== i) as never, { shouldDirty: true });

  return (
    <div className="space-y-4">
      {/* Prompt */}
      <div className="space-y-2">
        <Label htmlFor="skill-prompt">Prompt</Label>
        <Controller
          name={"promptText" as never}
          control={control}
          render={({ field }) => (
            <MarkdownEditor
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              height={160}
              placeholder="Describe what this skill does and how to use it"
              hideToolbar
            />
          )}
        />
      </div>
      <DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />

      {/* Metadata */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>Metadata</Label>
            <span className="text-[10px] text-zinc-600">e.g. <span className="font-mono">language: typescript</span></span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addEntry}
            className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-100 gap-1 self-start"
          >
            <Plus size={12} />
            Add
          </Button>
        </div>
        {metadata.length === 0 && (
          <p className="text-xs text-zinc-600 italic">No metadata entries.</p>
        )}
        <div className="space-y-2">
          {metadata.map((entry, i) => {
            const keyOk = isValidSlug(entry.key ?? "");
            const valOk = isValidSlug(entry.value ?? "");
            return (
              <div key={i} className="flex items-start gap-1.5">
                <div className="flex flex-col flex-1">
                  <Controller
                    name={`metadata.${i}.key` as never}
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="key"
                        className={`bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-xs h-8 ${!keyOk ? "border-red-600/60" : ""}`}
                        onBlur={(e) => field.onChange(e.target.value.trim())}
                      />
                    )}
                  />
                  {!keyOk && <p className="text-[10px] text-red-400 mt-0.5 px-1">lowercase, digits, hyphens only</p>}
                </div>
                <div className="flex flex-col flex-1">
                  <Controller
                    name={`metadata.${i}.value` as never}
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="value"
                        className={`bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-xs h-8 ${!valOk ? "border-red-600/60" : ""}`}
                        onBlur={(e) => field.onChange(e.target.value.trim())}
                      />
                    )}
                  />
                  {!valOk && <p className="text-[10px] text-red-400 mt-0.5 px-1">lowercase, digits, hyphens only</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEntry(i)}
                  className="h-8 w-8 shrink-0 text-zinc-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
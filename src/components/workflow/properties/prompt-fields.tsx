"use client";

import { useEffect } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { DollarSign, Braces } from "lucide-react";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import type { FormControl, FormSetValue } from "./types";

const DYNAMIC_VAR_RE = /\$(\d+)/g;
const STATIC_VAR_RE = /\{\{([^}]+)}}/g;

export function detectVariables(text: string): { dynamic: string[]; static: string[] } {
  const dynamic = [...new Set([...text.matchAll(DYNAMIC_VAR_RE)].map((m) => `$${m[1]}`))];
  const staticVars = [...new Set([...text.matchAll(STATIC_VAR_RE)].map((m) => m[1].trim()))];
  return { dynamic, static: staticVars };
}

interface PromptFieldsProps {
  control: FormControl;
  setValue: FormSetValue;
}

export function PromptFields({ control, setValue }: PromptFieldsProps) {
  const promptText: string = useWatch({ control, name: "promptText" }) ?? "";
  const { dynamic, static: staticVars } = detectVariables(promptText);
  const allVars = [...dynamic, ...staticVars];

  useEffect(() => {
    setValue("detectedVariables" as never, allVars as never, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="promptText">Prompt</Label>
        <Controller
          name="promptText"
          control={control}
          render={({ field }) => (
            <MarkdownEditor
              value={field.value ?? ""}
              onChange={field.onChange}
              height={200}
            />
          )}
        />
      </div>

      {allVars.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Detected Variables</Label>
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-3 space-y-2">
            {dynamic.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                  <DollarSign className="h-3 w-3" />
                  Dynamic
                </div>
                <div className="flex flex-wrap gap-1">
                  {dynamic.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center text-[11px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded-md"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {staticVars.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                  <Braces className="h-3 w-3" />
                  Static References
                </div>
                <div className="flex flex-wrap gap-1">
                  {staticVars.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center text-[11px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded-md"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


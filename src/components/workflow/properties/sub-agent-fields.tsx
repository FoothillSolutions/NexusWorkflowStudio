"use client";

import { useEffect } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Input } from "@/components/ui/input";
import { detectVariables, DetectedVariablesPanel } from "./variable-utils";
import { SubAgentModel, SubAgentMemory } from "@/types/workflow";
import type { FormControl, FormSetValue } from "./types";

// ── Option lists ────────────────────────────────────────────────────────────
const MODEL_OPTIONS: { value: SubAgentModel; label: string }[] = [
  { value: SubAgentModel.Inherit, label: "Inherit" },
  { value: SubAgentModel.Haiku,   label: "Haiku"   },
  { value: SubAgentModel.Sonnet,  label: "Sonnet"  },
  { value: SubAgentModel.Opus,    label: "Opus"    },
];

const MEMORY_OPTIONS: { value: SubAgentMemory; label: string }[] = [
  { value: SubAgentMemory.Default, label: "- (default)" },
  { value: SubAgentMemory.Local,   label: "local"        },
  { value: SubAgentMemory.User,    label: "user"         },
  { value: SubAgentMemory.Project, label: "project"      },
];

// ── Shared select style ─────────────────────────────────────────────────────
const SELECT_CLASS =
  "w-full rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-600";

// ── Component ───────────────────────────────────────────────────────────────
interface SubAgentFieldsProps {
  control: FormControl;
  setValue: FormSetValue;
}

export function SubAgentFields({ control, setValue }: SubAgentFieldsProps) {
  const promptText: string = useWatch({ control, name: "promptText" }) ?? "";
  const { dynamic, static: staticVars } = detectVariables(promptText);
  const allVars = [...dynamic, ...staticVars];

  useEffect(() => {
    setValue("detectedVariables" as never, allVars as never, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText]);

  return (
    <div className="space-y-4">
      {/* Prompt */}
      <div className="space-y-2">
        <Label htmlFor="promptText">Prompt</Label>
        <Controller
          name="promptText"
          control={control}
          render={({ field }) => (
            <MarkdownEditor
              value={field.value ?? ""}
              onChange={field.onChange}
              height={180}
              placeholder="Enter your prompt here"
              hideToolbar
            />
          )}
        />
      </div>

      <DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />

      {/* Model */}
      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Controller
          name="model"
          control={control}
          render={({ field }) => (
            <select id="model" className={SELECT_CLASS} value={field.value} onChange={field.onChange}>
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Memory */}
      <div className="space-y-2">
        <Label htmlFor="memory">Memory</Label>
        <Controller
          name="memory"
          control={control}
          render={({ field }) => (
            <select id="memory" className={SELECT_CLASS} value={field.value} onChange={field.onChange}>
              {MEMORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <Label htmlFor="tools">Tools (comma-separated)</Label>
        <Controller
          name="tools"
          control={control}
          render={({ field }) => (
            <Input
              id="tools"
              placeholder="e.g., Read,Write,Bash"
              className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
              value={field.value ?? ""}
              onChange={field.onChange}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">Leave empty for all tools</p>
      </div>
    </div>
  );
}

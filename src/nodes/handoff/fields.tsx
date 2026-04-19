"use client";

import { Controller, useWatch } from "react-hook-form";
import { FileText, MessageSquareText, List, AlignLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FormControl, FormRegister, FormSetValue } from "@/nodes/shared/form-types";
import type { HandoffMode, HandoffPayloadSection, HandoffPayloadStyle } from "@/types/workflow";
import { HANDOFF_PAYLOAD_SECTIONS } from "./constants";

interface HandoffFieldsProps {
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
}

export function Fields({ register, control, setValue }: HandoffFieldsProps) {
  const mode: HandoffMode = (useWatch({ control, name: "mode" }) as HandoffMode | undefined) ?? "file";
  const payloadStyle: HandoffPayloadStyle =
    (useWatch({ control, name: "payloadStyle" }) as HandoffPayloadStyle | undefined) ?? "structured";
  const payloadSections: HandoffPayloadSection[] =
    (useWatch({ control, name: "payloadSections" }) as HandoffPayloadSection[] | undefined) ?? [];

  const togglePayloadSection = (value: HandoffPayloadSection) => {
    const next = payloadSections.includes(value)
      ? payloadSections.filter((v) => v !== value)
      : [...payloadSections, value];
    setValue("payloadSections" as never, next as never, { shouldDirty: true });
  };

  return (
    <div className="space-y-5 overflow-hidden">
      {/* Mode toggle */}
      <div className="space-y-2">
        <Label>Handoff Mode</Label>
        <Controller
          name="mode"
          control={control}
          render={({ field }) => {
            const activeMode: HandoffMode = (field.value as HandoffMode | undefined) ?? "file";
            return (
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
                <button
                  type="button"
                  onClick={() => field.onChange("file")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                    activeMode === "file"
                      ? "bg-cyan-600/30 text-cyan-200 border border-cyan-500/50"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 border border-transparent",
                  )}
                >
                  <FileText size={12} />
                  File
                </button>
                <button
                  type="button"
                  onClick={() => field.onChange("context")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                    activeMode === "context"
                      ? "bg-cyan-600/30 text-cyan-200 border border-cyan-500/50"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 border border-transparent",
                  )}
                >
                  <MessageSquareText size={12} />
                  Context
                </button>
              </div>
            );
          }}
        />
        <p className="text-[11px] text-zinc-600">
          {mode === "file"
            ? "File: upstream agent writes a temp handoff file; downstream agent reads it at startup."
            : "Context: upstream agent ends its response with a Handoff Payload section, inlined into the downstream agent's prompt at runtime."}
        </p>
      </div>

      {mode === "file" && (
        <div className="space-y-2">
          <Label htmlFor="fileName">File name</Label>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-zinc-500 shrink-0">./tmp/handoff-</span>
            <Input
              id="fileName"
              placeholder="nodeId"
              className="bg-zinc-800/60 border-zinc-700/60 rounded-xl font-mono text-sm focus-visible:ring-zinc-600"
              {...register("fileName")}
            />
            <span className="font-mono text-[11px] text-zinc-500 shrink-0">.json</span>
          </div>
          <p className="text-[11px] leading-tight text-zinc-500">
            Leave blank to use the node id. Allowed characters: letters, numbers, hyphens, underscores.
          </p>
        </div>
      )}

      {/* Payload style toggle */}
      <div className="space-y-2">
        <Label>Payload Style</Label>
        <Controller
          name="payloadStyle"
          control={control}
          render={({ field }) => {
            const activeStyle: HandoffPayloadStyle = (field.value as HandoffPayloadStyle | undefined) ?? "structured";
            return (
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
                <button
                  type="button"
                  onClick={() => field.onChange("structured")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                    activeStyle === "structured"
                      ? "bg-cyan-600/30 text-cyan-200 border border-cyan-500/50"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 border border-transparent",
                  )}
                >
                  <List size={12} />
                  Structured
                </button>
                <button
                  type="button"
                  onClick={() => field.onChange("freeform")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                    activeStyle === "freeform"
                      ? "bg-cyan-600/30 text-cyan-200 border border-cyan-500/50"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 border border-transparent",
                  )}
                >
                  <AlignLeft size={12} />
                  Freeform
                </button>
              </div>
            );
          }}
        />
      </div>

      {payloadStyle === "structured" ? (
        <div className="space-y-2.5">
          <Label>Payload Sections</Label>
          <p className="text-[11px] leading-tight text-zinc-500">
            Sections the upstream agent should produce. Pick only what the downstream agent actually needs.
          </p>
          <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {HANDOFF_PAYLOAD_SECTIONS.map((section) => {
                const isActive = payloadSections.includes(section.value);
                return (
                  <button
                    key={section.value}
                    type="button"
                    onClick={() => togglePayloadSection(section.value)}
                    title={section.description}
                    className={cn(
                      "select-none whitespace-nowrap rounded-lg border py-1 pl-1.5 pr-2.5 font-mono text-[11px] transition-all duration-150",
                      isActive
                        ? "border-cyan-700/50 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-950/60"
                        : "border-zinc-700/50 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600/60 hover:bg-zinc-700/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                        isActive ? "bg-cyan-400/80" : "bg-zinc-600",
                      )}
                    />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="payloadPrompt">Payload Prompt</Label>
          <Textarea
            id="payloadPrompt"
            rows={5}
            placeholder="Describe what the downstream agent should know — what you did, what's left, any blockers, file paths, etc."
            className="resize-none bg-zinc-800/60 border-zinc-700/60 rounded-xl text-sm focus-visible:ring-zinc-600"
            {...register("payloadPrompt")}
          />
          <p className="text-[11px] leading-tight text-zinc-500">
            The upstream agent will shape its Handoff Payload body to follow these instructions.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Freeform additional instructions appended to the Handoff Payload."
          className="resize-none bg-zinc-800/60 border-zinc-700/60 rounded-xl text-sm focus-visible:ring-zinc-600"
          {...register("notes")}
        />
      </div>
    </div>
  );
}

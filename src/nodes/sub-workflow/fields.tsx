"use client";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layers, ExternalLink, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_ACCENT } from "@/lib/node-colors";
import { SubAgentMemory } from "@/nodes/sub-agent/enums";
import { PRESET_COLORS } from "@/nodes/sub-agent/constants";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { ModelSelect } from "@/nodes/shared/model-select";
import type { SubWorkflowMode } from "./types";
import { useTools } from "@/hooks/use-tools";

// ── Shared select / option configs ──────────────────────────────────────────


const MEMORY_OPTIONS = [
  { value: SubAgentMemory.Default, label: "- (default)" },
  { value: SubAgentMemory.Local, label: "local" },
  { value: SubAgentMemory.User, label: "user" },
  { value: SubAgentMemory.Project, label: "project" },
];

const SELECT_CLASS =
  "w-full rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-600";

interface SubWorkflowFieldsProps {
  control: FormControl;
  setValue: FormSetValue;
  nodeId?: string;
}

export function Fields({ control, setValue, nodeId }: SubWorkflowFieldsProps) {
  const mode: SubWorkflowMode = useWatch({ control, name: "mode" }) ?? "same-context";
  const nodeCount: number = useWatch({ control, name: "nodeCount" }) ?? 0;
  const label: string = useWatch({ control, name: "label" }) ?? "Sub Workflow";
  const rawTemp = useWatch({ control, name: "temperature" });
  const temperature = rawTemp != null ? Number(rawTemp) : 0;
  const color: string = useWatch({ control, name: "color" }) || NODE_ACCENT["sub-workflow"];
  const disabledTools: string[] = useWatch({ control, name: "disabledTools" }) ?? [];
  const modelValue: string = useWatch({ control, name: "model" }) ?? "inherit";

  // Fetch dynamic tools for the selected model (falls back to static AGENT_TOOLS)
  const { tools: availableTools, isLoading: toolsLoading, isStatic: toolsStatic } = useTools(modelValue);

  const toggleTool = (tool: string) => {
    const next = disabledTools.includes(tool)
      ? disabledTools.filter((t) => t !== tool)
      : [...disabledTools, tool];
    setValue("disabledTools" as never, next as never, { shouldDirty: true });
  };

  const handleOpenSubWorkflow = () => {
    if (nodeId) {
      window.dispatchEvent(new CustomEvent("nexus:open-sub-workflow", { detail: { nodeId } }));
    }
  };

  return (
    <div className="space-y-5">
      {/* Node count (readonly) */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-purple-400" />
          <span className="text-sm text-zinc-300">Nodes inside</span>
        </div>
        <span className="text-sm font-mono font-semibold text-zinc-100">{nodeCount}</span>
      </div>

      {/* Open sub-workflow button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 rounded-xl border-purple-800/50 text-purple-300 hover:bg-purple-950/30 hover:text-purple-200"
        onClick={handleOpenSubWorkflow}
      >
        <ExternalLink size={14} />
        Open Sub-Workflow Editor
      </Button>

      {/* Mode toggle */}
      <div className="space-y-2">
        <Label>Execution Mode</Label>
        <Controller
          name="mode"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
              {(["same-context", "agent"] as SubWorkflowMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => field.onChange(m)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                    field.value === m
                      ? "bg-purple-600/30 text-purple-200 border border-purple-500/50"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 border border-transparent"
                  )}
                >
                  {m === "same-context" ? "Same Context" : "Agent"}
                </button>
              ))}
            </div>
          )}
        />
        <p className="text-[11px] text-zinc-600">
          {mode === "same-context"
            ? "Sub-workflow runs inline in the parent context."
            : "Sub-workflow runs as an independent delegated agent."}
        </p>
      </div>

      {/* ── Agent-mode fields ─────────────────────────────────────────── */}
      {mode === "agent" && (
        <>
          {/* Auto-description info */}
          <div className="px-3 py-2 rounded-xl bg-violet-950/30 border border-violet-800/30 text-[11px] text-violet-300/80">
            Agent description: <span className="font-medium text-violet-200">&quot;Execute the {label} workflow&quot;</span>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Controller
              name="model"
              control={control}
              render={({ field }) => (
                <ModelSelect value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          {/* Memory */}
          <div className="space-y-2 opacity-40 pointer-events-none">
            <div className="flex items-center gap-2">
              <Label htmlFor="memory">Memory</Label>
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Coming soon</span>
            </div>
            <Controller
              name="memory"
              control={control}
              render={({ field }) => (
                <select id="memory" className={SELECT_CLASS} value={field.value} onChange={field.onChange} disabled>
                  {MEMORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            />
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature">Temperature</Label>
              <span className="text-xs font-mono text-zinc-400 tabular-nums">{temperature.toFixed(1)}</span>
            </div>
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => {
                const val = field.value != null ? Number(field.value) : 0;
                return (
                  <div className="relative flex items-center">
                    <input
                      id="temperature"
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={val}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="w-full h-2 appearance-none cursor-pointer rounded-full bg-zinc-700/60 accent-violet-500"
                      style={{
                        background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(val * 100).toFixed(1)}%, rgb(63 63 70 / 0.6) ${(val * 100).toFixed(1)}%, rgb(63 63 70 / 0.6) 100%)`,
                      }}
                    />
                  </div>
                );
              }}
            />
            <div className="flex justify-between text-[10px] text-zinc-600 font-mono px-0.5">
              <span>Deterministic</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Tools */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                Tools
                {!toolsStatic && !toolsLoading && (
                  <span className="text-[9px] font-medium text-violet-400/70 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full leading-none">
                    dynamic
                  </span>
                )}
              </Label>
              <div className="flex items-center gap-1.5">
                {toolsLoading && <Loader2 size={10} className="animate-spin text-zinc-500" />}
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {disabledTools.length === 0 ? "All enabled" : `${disabledTools.length} disabled`}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 p-2.5">
              <div className="flex flex-wrap gap-1.5">
                {availableTools.map((tool) => {
                  const isDisabled = disabledTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      title={tool}
                      className={cn(
                        "inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all duration-150 whitespace-nowrap select-none",
                        isDisabled
                          ? "bg-red-950/40 border-red-900/40 text-red-400/80 hover:bg-red-950/60"
                          : "bg-zinc-800/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/60 hover:border-zinc-600/60"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
                        isDisabled ? "bg-red-500/70" : "bg-emerald-500/70"
                      )} />
                      <span className={cn(isDisabled && "line-through decoration-red-500/40")}>
                        {tool}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2.5">
            <Label>Color</Label>
            <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 overflow-hidden">
              {/* Live preview bar */}
              <div
                className="h-2 w-full transition-colors duration-200"
                style={{ backgroundColor: color }}
              />
              {/* Preset swatches */}
              <div className="p-3 pb-2.5">
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {PRESET_COLORS.map((preset) => {
                    const isActive = color === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setValue("color" as never, preset as never, { shouldDirty: true })}
                        className={cn(
                          "w-6 h-6 rounded-full transition-all duration-150 flex items-center justify-center ring-offset-1 ring-offset-zinc-900",
                          isActive
                            ? "ring-2 ring-white/60 scale-110"
                            : "hover:scale-110 hover:ring-1 hover:ring-white/20"
                        )}
                        style={{ backgroundColor: preset }}
                        title={preset}
                      >
                        {isActive && (
                          <Check className="h-2.5 w-2.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Custom color row */}
              <div className="px-3 pb-3">
                <Controller
                  name="color"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 border border-zinc-700/30 px-2 py-1.5">
                      <div className="relative">
                        <input
                          type="color"
                          value={field.value?.trim() ? field.value : NODE_ACCENT["sub-workflow"]}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Pick custom color"
                        />
                        <div
                          className="w-6 h-6 rounded-md border border-zinc-600/50 cursor-pointer shadow-sm"
                          style={{ backgroundColor: field.value?.trim() ? field.value : NODE_ACCENT["sub-workflow"] }}
                        />
                      </div>
                      <Input
                        value={field.value?.trim() ? field.value : NODE_ACCENT["sub-workflow"]}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="bg-transparent border-0 shadow-none focus-visible:ring-0 font-mono text-xs uppercase text-zinc-300 h-6 px-1"
                        placeholder={NODE_ACCENT["sub-workflow"]}
                        maxLength={7}
                      />
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


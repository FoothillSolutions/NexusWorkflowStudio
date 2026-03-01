"use client";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layers, ExternalLink, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_ACCENT } from "@/lib/node-colors";
import { SubAgentModel, SubAgentMemory, MODEL_DISPLAY_NAMES } from "@/nodes/sub-agent/enums";
import { AGENT_TOOLS, PRESET_COLORS } from "@/nodes/sub-agent/constants";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import type { SubWorkflowMode } from "./types";

// ── Shared select / option configs ──────────────────────────────────────────

const MODEL_GROUPS = [
  { label: "Anthropic Claude", options: [SubAgentModel.Haiku35, SubAgentModel.Sonnet35, SubAgentModel.Sonnet37, SubAgentModel.Opus4, SubAgentModel.Sonnet4] },
  { label: "OpenAI", options: [SubAgentModel.GPT4o, SubAgentModel.GPT4oMini, SubAgentModel.O3, SubAgentModel.O3Mini, SubAgentModel.O4Mini] },
  { label: "Google", options: [SubAgentModel.Gemini25Pro, SubAgentModel.Gemini25Flash] },
  { label: "xAI", options: [SubAgentModel.Grok3, SubAgentModel.Grok3Mini] },
  { label: "DeepSeek", options: [SubAgentModel.DeepSeekV3, SubAgentModel.DeepSeekR1] },
];

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
                <select id="model" className={SELECT_CLASS} value={field.value} onChange={field.onChange}>
                  <option value={SubAgentModel.Inherit}>{MODEL_DISPLAY_NAMES[SubAgentModel.Inherit]}</option>
                  {MODEL_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((m) => (
                        <option key={m} value={m}>{MODEL_DISPLAY_NAMES[m]}</option>
                      ))}
                    </optgroup>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Disabled Tools</Label>
              <span className="text-[10px] text-zinc-500">
                {disabledTools.length === 0 ? "All enabled" : `${disabledTools.length} disabled`}
              </span>
            </div>
            <p className="text-xs text-zinc-600">Toggle off tools you want to disable for this agent.</p>
            <div className="grid grid-cols-3 gap-1.5">
              {AGENT_TOOLS.map((tool) => {
                const isDisabled = disabledTools.includes(tool);
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className={cn(
                      "flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-mono transition-all duration-150",
                      isDisabled
                        ? "bg-red-950/50 border-red-800/50 text-red-400 line-through opacity-70"
                        : "bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/50"
                    )}
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setValue("color" as never, preset as never, { shouldDirty: true })}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all duration-150 hover:scale-110",
                      color === preset ? "border-white ring-2 ring-white/30 scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: preset }}
                    title={preset}
                  >
                    {color === preset && <Check className="h-3 w-3 text-white/90 mx-auto drop-shadow" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  name="color"
                  control={control}
                  render={({ field }) => (
                    <>
                      <input
                        type="color"
                        value={field.value?.trim() ? field.value : NODE_ACCENT["sub-workflow"]}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-700/60 bg-transparent p-0.5"
                        title="Custom color"
                      />
                      <Input
                        value={field.value?.trim() ? field.value : NODE_ACCENT["sub-workflow"]}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-xs uppercase"
                        placeholder={NODE_ACCENT["sub-workflow"]}
                        maxLength={7}
                      />
                    </>
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


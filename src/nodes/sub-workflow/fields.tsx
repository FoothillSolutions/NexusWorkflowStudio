"use client";

import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Layers, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_ACCENT } from "@/lib/node-colors";
import { SubAgentMemory } from "@/nodes/agent/enums";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { ModelSelect } from "@/nodes/shared/model-select";
import { useTools } from "@/hooks/use-tools";
import { ToolsGrid } from "@/nodes/agent/properties/tools-grid";
import { ColorPicker } from "@/nodes/agent/properties/color-picker";
import type { SubWorkflowMode } from "./types";

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
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 border border-transparent",
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
              render={({ field }) => <ModelSelect value={field.value} onChange={field.onChange} />}
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
                );
              }}
            />
            <div className="flex justify-between text-[10px] text-zinc-600 font-mono px-0.5">
              <span>Deterministic</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Tools */}
          <ToolsGrid
            tools={availableTools}
            disabledTools={disabledTools}
            isLoading={toolsLoading}
            isStatic={toolsStatic}
            onToggle={toggleTool}
          />

          {/* Color */}
          <ColorPicker control={control} setValue={setValue} color={color} defaultColor={NODE_ACCENT["sub-workflow"]} />
        </>
      )}
    </div>
  );
}


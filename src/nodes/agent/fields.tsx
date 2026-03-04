"use client";

import { useEffect } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PromptFieldGroup } from "@/nodes/shared/prompt-field-group";
import { detectVariables, DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { NODE_ACCENT } from "@/lib/node-colors";
import { ModelSelect } from "@/nodes/shared/model-select";
import { useTools } from "@/hooks/use-tools";
import { SubAgentMemory } from "./types";
import { AiPromptGenerator } from "./ai-prompt-generator";
import { UploadAgentButton } from "./properties/upload-agent-button";
import { StaticVariableMapping } from "./properties/static-variable-mapping";
import { ParameterMapping } from "./properties/parameter-mapping";
import { ConnectedNodesList } from "./properties/connected-nodes-list";
import { ToolsGrid } from "./properties/tools-grid";
import { ColorPicker } from "./properties/color-picker";
import { useConnectedResources } from "./properties/use-connected-resources";

const MEMORY_OPTIONS = [
  { value: SubAgentMemory.Default, label: "- (default)" },
  { value: SubAgentMemory.Local, label: "local" },
  { value: SubAgentMemory.User, label: "user" },
  { value: SubAgentMemory.Project, label: "project" },
];

const SELECT_CLASS =
  "w-full rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-600";

interface SubAgentFieldsProps {
  control: FormControl;
  setValue: FormSetValue;
  nodeId?: string;
}

export function Fields({ control, setValue, nodeId }: SubAgentFieldsProps) {
  const promptText: string = useWatch({ control, name: "promptText" }) ?? "";
  const rawTemp = useWatch({ control, name: "temperature" });
  const temperature = rawTemp != null ? Number(rawTemp) : 0;
  const color: string = useWatch({ control, name: "color" }) || NODE_ACCENT.agent;
  const disabledTools: string[] = useWatch({ control, name: "disabledTools" }) ?? [];
  const parameterMappings: string[] = useWatch({ control, name: "parameterMappings" }) ?? [];
  const variableMappings: Record<string, string> = useWatch({ control, name: "variableMappings" }) ?? {};
  const modelValue: string = useWatch({ control, name: "model" }) ?? "inherit";

  const { tools: availableTools, isLoading: toolsLoading, isStatic: toolsStatic } = useTools(modelValue);
  const { connectedSkills, connectedDocs, availableResources, deleteEdge } = useConnectedResources(nodeId);
  const { dynamic, static: staticVars } = detectVariables(promptText);

  useEffect(() => {
    setValue("detectedVariables" as never, [...dynamic, ...staticVars] as never, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText]);

  useEffect(() => {
    if (dynamic.length > parameterMappings.length) {
      const expanded = [...parameterMappings];
      while (expanded.length < dynamic.length) expanded.push(`$${expanded.length + 1}`);
      setValue("parameterMappings" as never, expanded as never, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamic.length]);

  const toggleTool = (tool: string) => {
    const next = disabledTools.includes(tool)
      ? disabledTools.filter((t) => t !== tool)
      : [...disabledTools, tool];
    setValue("disabledTools" as never, next as never, { shouldDirty: true });
  };

  return (
    <div className="space-y-5 overflow-hidden">
      <UploadAgentButton setValue={setValue} />

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description <RequiredIndicator /></Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea
              id="description"
              placeholder="What does this agent do?"
              className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 min-h-[72px] resize-none text-sm"
              value={field.value ?? ""}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <PromptFieldGroup
        control={control}
        setValue={setValue}
        value={promptText}
        label="Prompt"
        htmlId="promptText"
        height={180}
        placeholder="Enter your prompt here"
        required
      />

      <AiPromptGenerator setValue={setValue} currentPrompt={promptText} nodeId={nodeId} />
      <DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />

      <StaticVariableMapping
        staticVars={staticVars}
        variableMappings={variableMappings}
        availableResources={availableResources}
        setValue={setValue}
      />

      <ParameterMapping
        parameterMappings={parameterMappings}
        dynamicVarCount={dynamic.length}
        setValue={setValue}
      />

      <ConnectedNodesList variant="skill" items={connectedSkills} onDeleteEdge={deleteEdge} />
      <ConnectedNodesList variant="doc" items={connectedDocs} onDeleteEdge={deleteEdge} />

      {/* Model */}
      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Controller
          name="model"
          control={control}
          render={({ field }) => <ModelSelect value={field.value} onChange={field.onChange} />}
        />
      </div>

      {/* Memory (coming soon) */}
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
                  background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(val * 100).toFixed(1)}%, rgb(63 63 70 / 0.6) ${(val * 100).toFixed(1)}%, rgb(63 63 70 / 0.6) 100%)`,
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

      <ToolsGrid
        tools={availableTools}
        disabledTools={disabledTools}
        isLoading={toolsLoading}
        isStatic={toolsStatic}
        onToggle={toggleTool}
      />

      <ColorPicker control={control} setValue={setValue} color={color} defaultColor={NODE_ACCENT.agent} />
    </div>
  );
}

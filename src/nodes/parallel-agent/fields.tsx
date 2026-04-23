"use client";

import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Network, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AiPromptGenerator } from "@/nodes/agent/ai-prompt-generator";
import { ConnectedNodesList } from "@/nodes/shared/connected-nodes-list";
import type { FormControl, FormRegister, FormSetValue } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { useConnectedResources } from "@/nodes/shared/use-connected-resources";
import { WorkflowNodeType, type ParallelAgentSpawnMode } from "@/types/workflow";
import { createParallelAgentBranch } from "./constants";

interface ParallelAgentFieldsProps {
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
  nodeId?: string;
}

export function Fields({ register, control, setValue, nodeId }: ParallelAgentFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "branches" as never,
  });

  const { connectedSkills, connectedDocs, deleteEdge } = useConnectedResources(nodeId);

  const spawnMode: ParallelAgentSpawnMode = (useWatch({ control, name: "spawnMode" }) as ParallelAgentSpawnMode | undefined) ?? "fixed";
  const sharedInstructions: string = (useWatch({ control, name: "sharedInstructions" }) as string | undefined) ?? "";

  const handleAddBranch = () => append(createParallelAgentBranch(fields.length) as never);

  const handleSpawnModeChange = (next: ParallelAgentSpawnMode) => {
    setValue("spawnMode" as never, next as never, { shouldDirty: true });
    if (next === "dynamic") {
      // Seed sensible starting values. User must type a criterion before the form validates.
      setValue("spawnCriterion" as never, "" as never, { shouldDirty: true });
      setValue("spawnMin" as never, 1 as never, { shouldDirty: true });
      setValue("spawnMax" as never, 3 as never, { shouldDirty: true });
    } else {
      // Fixed mode: clear criterion, reset min/max to 1 (schema-required).
      setValue("spawnCriterion" as never, "" as never, { shouldDirty: true });
      setValue("spawnMin" as never, 1 as never, { shouldDirty: true });
      setValue("spawnMax" as never, 1 as never, { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-5 overflow-hidden">
      {/* Mode toggle */}
      <div className="space-y-2">
        <Label>Spawn Mode</Label>
        <Controller
          name="spawnMode"
          control={control}
          render={({ field }) => {
            const activeMode: ParallelAgentSpawnMode = (field.value as ParallelAgentSpawnMode | undefined) ?? "fixed";
            return (
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
                <button
                  type="button"
                  onClick={() => handleSpawnModeChange("fixed")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                    activeMode === "fixed"
                      ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/50"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 border border-transparent",
                  )}
                >
                  <Network size={12} />
                  Fixed
                </button>
                <button
                  type="button"
                  onClick={() => handleSpawnModeChange("dynamic")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                    activeMode === "dynamic"
                      ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/50"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 border border-transparent",
                  )}
                >
                  <Sparkles size={12} />
                  Dynamic
                </button>
              </div>
            );
          }}
        />
        <p className="text-[11px] text-zinc-600">
          {spawnMode === "fixed"
            ? "Fixed: hand-author branches, each wired to its own agent."
            : "Dynamic: a single template agent cloned at runtime by criterion within a min/max range."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sharedInstructions">Shared Execution Instructions</Label>
        <p className="text-[11px] leading-tight text-zinc-500">
          These instructions are shared with every spawned downstream agent. Attach skill and document nodes here to make them available to the full parallel group.
        </p>
        <Textarea
          id="sharedInstructions"
          rows={4}
          placeholder="Explain the shared goal, how the agents should coordinate, and what they all have in common."
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 min-h-24 resize-y text-sm"
          {...register("sharedInstructions")}
        />
        <AiPromptGenerator
          setValue={setValue}
          currentPrompt={sharedInstructions}
          nodeId={nodeId}
          nodeType={WorkflowNodeType.ParallelAgent}
          fieldName="sharedInstructions"
        />
      </div>

      <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 px-3 py-2.5 text-[11px] leading-relaxed text-indigo-200/85">
        {spawnMode === "fixed"
          ? <>Connect each branch output to an external <span className="font-mono">Agent</span> node on the canvas. Shared documents and skills connected here are available to every spawned downstream agent.</>
          : <>Connect the single output to one template <span className="font-mono">Agent</span> node. That agent will be cloned at runtime per the criterion below, bounded by the min/max. Shared documents and skills are available to every cloned agent.</>
        }
      </div>

      <ConnectedNodesList variant="skill" items={connectedSkills} onDeleteEdge={deleteEdge} />
      <ConnectedNodesList variant="doc" items={connectedDocs} onDeleteEdge={deleteEdge} />

      <Separator className="border-zinc-800" />

      {spawnMode === "fixed" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label>Parallel Branches ({fields.length})</Label>
              <p className="text-[11px] text-zinc-500">At least 1 branch is required, and each branch can target an external agent node</p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleAddBranch}>
              <Plus className="h-3 w-3" />
              Add Branch
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => {

              return (
                <div key={field.id} className="rounded-xl border border-zinc-700/50 bg-zinc-800/25 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">Branch {index + 1}</div>
                      <div className="text-[11px] text-zinc-500">This branch output should connect to the agent node that gets spawned in parallel.</div>
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`branches.${index}.label`}>
                        Branch Label <RequiredIndicator />
                      </Label>
                      <Input
                        id={`branches.${index}.label`}
                        placeholder={`Branch ${index + 1}`}
                        className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg focus-visible:ring-zinc-600"
                        {...register(`branches.${index}.label` as never)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`branches.${index}.spawnCount`}>
                        Spawn Count <RequiredIndicator />
                      </Label>
                      <Input
                        id={`branches.${index}.spawnCount`}
                        type="number"
                        min={1}
                        step={1}
                        placeholder="1"
                        className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg font-mono focus-visible:ring-zinc-600"
                        {...register(`branches.${index}.spawnCount` as never, { valueAsNumber: true, min: 1 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`branches.${index}.instructions`}>Branch Instructions</Label>
                    <Textarea
                      id={`branches.${index}.instructions`}
                      rows={3}
                      placeholder="Describe what this branch should ask the connected agent to focus on, or how to partition the parallel work."
                      className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg focus-visible:ring-zinc-600 resize-none"
                      {...register(`branches.${index}.instructions` as never)}
                    />
                  </div>

                  <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-400">
                    Output handle: <span className="font-mono text-zinc-200">branch-{index}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-0.5">
            <Label>Spawn Criterion</Label>
            <p className="text-[11px] text-zinc-500">
              In dynamic mode, the parallel-agent has one output handle that connects to a single agent template.
              That agent will be cloned at runtime per the criterion below, bounded by the min/max.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spawnCriterion">
              Criterion <RequiredIndicator />
            </Label>
            <Textarea
              id="spawnCriterion"
              rows={3}
              placeholder='e.g. "one agent per detected topic" or "one per item in the input list"'
              className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg focus-visible:ring-zinc-600 resize-none"
              {...register("spawnCriterion" as never)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="spawnMin">
                Min <RequiredIndicator />
              </Label>
              <Input
                id="spawnMin"
                type="number"
                min={1}
                step={1}
                placeholder="1"
                className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg font-mono focus-visible:ring-zinc-600"
                {...register("spawnMin" as never, { valueAsNumber: true, min: 1 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spawnMax">
                Max <RequiredIndicator />
              </Label>
              <Input
                id="spawnMax"
                type="number"
                min={1}
                step={1}
                placeholder="1"
                className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg font-mono focus-visible:ring-zinc-600"
                {...register("spawnMax" as never, { valueAsNumber: true, min: 1 })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-400">
            Output handle: <span className="font-mono text-zinc-200">output</span>
          </div>
        </div>
      )}
    </div>
  );
}


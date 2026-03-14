"use client";

import { useFieldArray } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ConnectedNodesList } from "@/nodes/agent/properties/connected-nodes-list";
import { useConnectedResources } from "@/nodes/agent/properties/use-connected-resources";
import type { FormControl, FormRegister } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { createParallelAgentBranch } from "./constants";

interface ParallelAgentFieldsProps {
  register: FormRegister;
  control: FormControl;
  nodeId?: string;
}

export function Fields({ register, control, nodeId }: ParallelAgentFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "branches" as never,
  });

  const { connectedSkills, connectedDocs, deleteEdge } = useConnectedResources(nodeId);

  const handleAddBranch = () => append(createParallelAgentBranch(fields.length) as never);

  return (
    <div className="space-y-5 overflow-hidden">
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
      </div>

      <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 px-3 py-2.5 text-[11px] leading-relaxed text-indigo-200/85">
        Connect each branch output to an external <span className="font-mono">Agent</span> node on the canvas. Shared documents and skills connected here are available to every spawned downstream agent.
      </div>

      <ConnectedNodesList variant="skill" items={connectedSkills} onDeleteEdge={deleteEdge} />
      <ConnectedNodesList variant="doc" items={connectedDocs} onDeleteEdge={deleteEdge} />

      <Separator className="border-zinc-800" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>Parallel Branches ({fields.length})</Label>
            <p className="text-[11px] text-zinc-500">Minimum 2 branches required, each targeting an external agent node</p>
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
                  {fields.length > 2 && (
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
    </div>
  );
}



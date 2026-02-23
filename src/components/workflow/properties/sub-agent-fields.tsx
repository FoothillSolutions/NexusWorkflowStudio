"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FormRegister } from "./types";

interface SubAgentFieldsProps {
  register: FormRegister;
}

export function SubAgentFields({ register }: SubAgentFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="agentName">Agent Name</Label>
        <Input
          id="agentName"
          placeholder="e.g. code-reviewer"
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("agentName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="taskText">Task Description</Label>
        <Textarea
          id="taskText"
          rows={4}
          placeholder="Describe the agent's task…"
          className="resize-none bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("taskText")}
        />
      </div>
    </>
  );
}


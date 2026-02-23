"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormRegister } from "./types";

interface SubAgentFlowFieldsProps {
  register: FormRegister;
}

export function SubAgentFlowFields({ register }: SubAgentFlowFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="flowRef">Flow Reference</Label>
        <Input
          id="flowRef"
          placeholder="Referenced workflow name or ID"
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("flowRef")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nodeCount">Node Count</Label>
        <Input
          id="nodeCount"
          type="number"
          min={0}
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("nodeCount", { valueAsNumber: true })}
        />
      </div>
    </>
  );
}


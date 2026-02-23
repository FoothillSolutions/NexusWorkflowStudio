"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FormRegister } from "@/nodes/shared/form-types";
interface McpToolFieldsProps { register: FormRegister; }
export function Fields({ register }: McpToolFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="toolName">Tool Name</Label>
        <Input id="toolName" placeholder="e.g. read_file" className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600" {...register("toolName")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paramsText">Parameters (JSON)</Label>
        <Textarea id="paramsText" rows={4} placeholder={`{"path": "/src/index.ts"}`} className="resize-none font-mono text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600" {...register("paramsText")} />
      </div>
    </>
  );
}
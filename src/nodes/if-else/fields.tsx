"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormRegister } from "@/nodes/shared/form-types";
interface IfElseFieldsProps { register: FormRegister; }
export function Fields({ register }: IfElseFieldsProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="expression">Condition Expression</Label>
      <Input id="expression" placeholder={`e.g. result.status === "success"`} className="font-mono text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600" {...register("expression")} />
    </div>
  );
}
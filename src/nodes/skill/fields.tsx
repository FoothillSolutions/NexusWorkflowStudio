"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormRegister } from "@/nodes/shared/form-types";
interface SkillFieldsProps { register: FormRegister; }
export function Fields({ register }: SkillFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="skillName">Skill Name</Label>
        <Input id="skillName" placeholder="e.g. playwright" className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600" {...register("skillName")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectName">Project Name</Label>
        <Input id="projectName" placeholder="e.g. my-app" className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600" {...register("projectName")} />
      </div>
    </>
  );
}
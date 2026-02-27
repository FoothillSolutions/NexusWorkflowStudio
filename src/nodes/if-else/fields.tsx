"use client";

import { useFieldArray } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { FormRegister, FormControl } from "@/nodes/shared/form-types";

interface IfElseFieldsProps {
  register: FormRegister;
  control: FormControl;
}

export function Fields({ register, control }: IfElseFieldsProps) {
  const { fields } = useFieldArray({ control, name: "branches" as never });

  return (
    <>
      {/* Evaluation Target */}
      <div className="space-y-1.5">
        <Label htmlFor="evaluationTarget">Evaluation Target</Label>
        <p className="text-[11px] text-zinc-500 leading-tight">
          Describe what to evaluate in the branch condition
        </p>
        <Input
          id="evaluationTarget"
          placeholder="e.g: Result of the previous step"
          className="text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("evaluationTarget")}
        />
      </div>

      <Separator className="border-zinc-800" />

      {/* Branches */}
      <div className="space-y-3">
        <Label>Branches</Label>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-3 space-y-2.5"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: index === 0 ? "#22c55e" : "#ef4444",
                  }}
                />
                <span className="text-xs font-medium text-zinc-300">
                  Branch {index + 1}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor={`branches.${index}.label`}
                  className="text-[11px] text-zinc-500"
                >
                  Label
                </Label>
                <Input
                  id={`branches.${index}.label`}
                  placeholder={index === 0 ? "True" : "False"}
                  className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg focus-visible:ring-zinc-600"
                  {...register(`branches.${index}.label` as const)}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor={`branches.${index}.condition`}
                  className="text-[11px] text-zinc-500"
                >
                  Condition (natural language)
                </Label>
                <Textarea
                  id={`branches.${index}.condition`}
                  placeholder={
                    index === 0
                      ? "e.g: When the result is successful"
                      : "e.g: When the result is not successful"
                  }
                  rows={2}
                  className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg focus-visible:ring-zinc-600 resize-none"
                  {...register(`branches.${index}.condition` as const)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
"use client";

import { useFieldArray } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";
import { NODE_ACCENT, BRANCH_DEFAULT } from "@/lib/node-colors";
import type { FormRegister, FormControl } from "@/nodes/shared/form-types";

interface SwitchFieldsProps {
  register: FormRegister;
  control: FormControl;
}

export function Fields({ register, control }: SwitchFieldsProps) {
  const { fields, insert, remove } = useFieldArray({
    control,
    name: "branches" as never,
  });

  // Last branch is always the default — non-removable, non-editable
  const editableCount = fields.length - 1;

  const handleAddBranch = () => {
    // Insert before the default branch (last item)
    insert(editableCount, { label: `Case ${editableCount + 1}`, condition: "" } as never);
  };

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
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>Branches ({fields.length})</Label>
            <p className="text-[11px] text-zinc-500">Minimum 2 branches required</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleAddBranch}
          >
            <Plus className="h-3 w-3" />
            Add Branch
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const isDefault = index === fields.length - 1;

            return (
              <div
                key={field.id}
                className={`rounded-xl border p-3 space-y-2.5 ${
                  isDefault
                    ? "border-zinc-600/40 bg-zinc-800/20"
                    : "border-zinc-700/50 bg-zinc-800/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-sm shrink-0"
                      style={{
                        backgroundColor: isDefault ? BRANCH_DEFAULT : NODE_ACCENT.switch,
                        opacity: isDefault ? 0.6 : 1,
                      }}
                    />
                    <span className="text-xs font-medium text-zinc-300">
                      {isDefault ? "Default Branch" : `Branch ${index + 1}`}
                    </span>
                  </div>
                  {!isDefault && editableCount > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {isDefault ? (
                  /* Default branch — read-only */
                  <div className="space-y-2 opacity-60">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-500">Label</Label>
                      <Input
                        value="default"
                        readOnly
                        className="text-sm bg-zinc-900/40 border-zinc-700/30 rounded-lg cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-500">Condition</Label>
                      <Input
                        value="Other cases"
                        readOnly
                        className="text-sm bg-zinc-900/40 border-zinc-700/30 rounded-lg cursor-not-allowed"
                      />
                    </div>
                  </div>
                ) : (
                  /* Editable branch */
                  <>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`branches.${index}.label`}
                        className="text-[11px] text-zinc-500"
                      >
                        Label
                      </Label>
                      <Input
                        id={`branches.${index}.label`}
                        placeholder={`Case ${index + 1}`}
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
                        placeholder={`e.g: When condition ${index + 1} is met`}
                        rows={2}
                        className="text-sm bg-zinc-900/60 border-zinc-700/40 rounded-lg focus-visible:ring-zinc-600 resize-none"
                        {...register(`branches.${index}.condition` as const)}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
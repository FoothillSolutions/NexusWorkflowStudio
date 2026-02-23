"use client";
import { useFieldArray } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, X } from "lucide-react";
import type { FormRegister, FormControl } from "@/nodes/shared/form-types";
interface AskUserFieldsProps { register: FormRegister; control: FormControl; }
export function Fields({ register, control }: AskUserFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "options" as never });
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="questionText">Question Text</Label>
        <Textarea id="questionText" rows={3} placeholder="What would you like to do?" className="resize-none bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600" {...register("questionText")} />
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Options</Label>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => append(`Option ${fields.length + 1}`)}>
            <Plus className="h-3 w-3" />Add Option
          </Button>
        </div>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input placeholder={`Option ${index + 1}`} className="text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600" {...register(`options.${index}` as const)} />
              {fields.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
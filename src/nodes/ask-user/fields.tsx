"use client";

import { useFieldArray, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Sparkles, ListChecks } from "lucide-react";
import type { FormRegister, FormControl, FormSetValue } from "@/nodes/shared/form-types";

interface AskUserFieldsProps {
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
}

export function Fields({ register, control, setValue }: AskUserFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "options" as never,
  });

  const multipleSelection = !!(useWatch({ control, name: "multipleSelection" as never }));
  const aiSuggestOptions = !!(useWatch({ control, name: "aiSuggestOptions" as never }));

  const handleToggleAiSuggest = () => {
    const next = !aiSuggestOptions;
    setValue("aiSuggestOptions" as never, next as never);
    if (next) {
      // Clear options when AI suggest is turned on
      setValue("options" as never, [] as never);
    } else {
      // Restore default options when AI suggest is turned off
      setValue("options" as never, [
        { label: "Option 1", description: "First Option" },
        { label: "Option 2", description: "Second Option" },
      ] as never);
    }
  };

  const handleToggleMultiSelect = () => {
    setValue("multipleSelection" as never, (!multipleSelection) as never);
  };

  const optionsDisabled = aiSuggestOptions;

  return (
    <>
      {/* Question */}
      <div className="space-y-2">
        <Label htmlFor="questionText">
          Question <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="questionText"
          rows={3}
          placeholder="What would you like to do?"
          className="resize-none bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("questionText")}
        />
      </div>

      <Separator className="border-zinc-800" />

      {/* Toggles */}
      <div className="space-y-3">
        <Label>Settings</Label>
        {/* Multiple Selection Toggle */}
        <button
          type="button"
          onClick={handleToggleMultiSelect}
          className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
            multipleSelection
              ? "border-pink-500/40 bg-pink-500/5"
              : "border-zinc-700/50 bg-zinc-800/20 hover:bg-zinc-800/40"
          }`}
        >
          <div
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
              multipleSelection
                ? "bg-pink-500/20 text-pink-400"
                : "bg-zinc-700/40 text-zinc-500"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className={`text-xs font-medium ${multipleSelection ? "text-pink-300" : "text-zinc-300"}`}>
              Multiple Selection
            </span>
            <span className="text-[11px] text-zinc-500 leading-tight">
              User selects one option (branches to corresponding node)
            </span>
          </div>
          <div
            className={`ml-auto mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors relative ${
              multipleSelection ? "bg-pink-500" : "bg-zinc-600"
            }`}
          >
            <div
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                multipleSelection ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </div>
        </button>

        {/* AI Suggests Options Toggle */}
        <button
          type="button"
          onClick={handleToggleAiSuggest}
          className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
            aiSuggestOptions
              ? "border-violet-500/40 bg-violet-500/5"
              : "border-zinc-700/50 bg-zinc-800/20 hover:bg-zinc-800/40"
          }`}
        >
          <div
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
              aiSuggestOptions
                ? "bg-violet-500/20 text-violet-400"
                : "bg-zinc-700/40 text-zinc-500"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className={`text-xs font-medium ${aiSuggestOptions ? "text-violet-300" : "text-zinc-300"}`}>
              AI Suggests Options
            </span>
            <span className="text-[11px] text-zinc-500 leading-tight">
              Automatically define options based on the question
            </span>
          </div>
          <div
            className={`ml-auto mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors relative ${
              aiSuggestOptions ? "bg-violet-500" : "bg-zinc-600"
            }`}
          >
            <div
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                aiSuggestOptions ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </div>
        </button>
      </div>

      <Separator className="border-zinc-800" />

      {/* Options Section */}
      <div className={`space-y-3 ${optionsDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>Options ({fields.length}/4)</Label>
            <p className="text-[11px] text-zinc-500">Min 2, max 4 options</p>
          </div>
          {!optionsDisabled && fields.length < 4 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() =>
                append({ label: `Option ${fields.length + 1}`, description: "" } as never)
              }
            >
              <Plus className="h-3 w-3" />
              Add Option
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-sm shrink-0"
                    style={{ backgroundColor: "#ec4899" }}
                  />
                  <span className="text-xs font-medium text-zinc-300">
                    Option {index + 1}
                  </span>
                </div>
                {fields.length > 2 && (
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

              <div className="space-y-1">
                <Label className="text-[11px] text-zinc-500">Label</Label>
                <Input
                  placeholder={`Option ${index + 1}`}
                  className="text-sm bg-zinc-800/60 border-zinc-700/60 rounded-lg focus-visible:ring-zinc-600"
                  {...register(`options.${index}.label` as const)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-zinc-500">Description</Label>
                <Input
                  placeholder="Describe this option..."
                  className="text-sm bg-zinc-800/60 border-zinc-700/60 rounded-lg focus-visible:ring-zinc-600"
                  {...register(`options.${index}.description` as const)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
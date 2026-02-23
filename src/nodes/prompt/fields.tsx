"use client";
import { useEffect } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { detectVariables, DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
interface PromptFieldsProps {
  control: FormControl;
  setValue: FormSetValue;
}
export function Fields({ control, setValue }: PromptFieldsProps) {
  const promptText: string = useWatch({ control, name: "promptText" }) ?? "";
  const { dynamic, static: staticVars } = detectVariables(promptText);
  const allVars = [...dynamic, ...staticVars];
  useEffect(() => {
    setValue("detectedVariables" as never, allVars as never, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText]);
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="promptText">Prompt</Label>
        <Controller name="promptText" control={control} render={({ field }) => (
          <MarkdownEditor value={field.value ?? ""} onChange={field.onChange} height={200} />
        )} />
      </div>
      <DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />
    </div>
  );
}
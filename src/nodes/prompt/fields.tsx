"use client";
import { useEffect } from "react";
import { useWatch } from "react-hook-form";
import { detectVariables, DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import { PromptFieldGroup } from "@/nodes/shared/prompt-field-group";
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
      <PromptFieldGroup
        control={control}
        setValue={setValue}
        value={promptText}
        height={200}
        required
      />
      <DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />
    </div>
  );
}
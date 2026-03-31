import { useEffect, useMemo } from "react";
import { useWatch } from "react-hook-form";
import { detectVariables } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";

interface UseDetectedVariablesOptions {
  control: FormControl;
  setValue: FormSetValue;
  fieldName?: string;
}

export function useDetectedVariables({
  control,
  setValue,
  fieldName = "promptText",
}: UseDetectedVariablesOptions) {
  const fieldValue: string = useWatch({ control, name: fieldName }) ?? "";
  const { dynamic, static: staticVars } = useMemo(
    () => detectVariables(fieldValue),
    [fieldValue],
  );
  const allVars = useMemo(() => [...dynamic, ...staticVars], [dynamic, staticVars]);

  useEffect(() => {
    setValue("detectedVariables" as never, allVars as never, {
      shouldDirty: false,
    });
  }, [allVars, setValue]);

  return {
    value: fieldValue,
    dynamic,
    staticVars,
    allVars,
  };
}


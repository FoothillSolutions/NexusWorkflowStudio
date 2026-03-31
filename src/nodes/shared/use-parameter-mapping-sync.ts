import { useEffect } from "react";
import type { FormSetValue } from "@/nodes/shared/form-types";

interface UseParameterMappingSyncOptions {
  dynamicVariableCount: number;
  parameterMappings: string[];
  setValue: FormSetValue;
}

export function useParameterMappingSync({
  dynamicVariableCount,
  parameterMappings,
  setValue,
}: UseParameterMappingSyncOptions) {
  useEffect(() => {
    if (dynamicVariableCount <= parameterMappings.length) return;

    const expanded = [...parameterMappings];
    while (expanded.length < dynamicVariableCount) {
      expanded.push(`$${expanded.length + 1}`);
    }

    setValue("parameterMappings" as never, expanded as never, {
      shouldDirty: false,
    });
  }, [dynamicVariableCount, parameterMappings, setValue]);
}


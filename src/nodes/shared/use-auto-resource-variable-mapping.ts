import { useEffect, useRef } from "react";
import type { FormSetValue } from "@/nodes/shared/form-types";
import type { AvailableResource } from "@/nodes/agent/properties/use-connected-resources";

interface UseAutoResourceVariableMappingOptions {
  staticVars: string[];
  availableResources: AvailableResource[];
  variableMappings: Record<string, string>;
  setValue: FormSetValue;
  isMatch: (variableName: string, resource: AvailableResource) => boolean;
}

export function useAutoResourceVariableMapping({
  staticVars,
  availableResources,
  variableMappings,
  setValue,
  isMatch,
}: UseAutoResourceVariableMappingOptions) {
  const mappingsRef = useRef(variableMappings);
  const prevCompositeKeyRef = useRef("");

  useEffect(() => {
    mappingsRef.current = variableMappings;
  }, [variableMappings]);

  useEffect(() => {
    if (staticVars.length === 0 || availableResources.length === 0) return;

    const resourceKey = availableResources.map((resource) => resource.value).join("|");
    const varsKey = staticVars.join(",");
    const compositeKey = `${varsKey}::${resourceKey}`;
    if (prevCompositeKeyRef.current === compositeKey) return;
    prevCompositeKeyRef.current = compositeKey;

    const updated = { ...mappingsRef.current };
    let changed = false;

    for (const variableName of staticVars) {
      if (updated[variableName]) continue;

      const match = availableResources.find((resource) =>
        isMatch(variableName, resource),
      );
      if (!match) continue;

      updated[variableName] = match.value;
      changed = true;
    }

    if (changed) {
      setValue("variableMappings" as never, updated as never, {
        shouldDirty: true,
      });
    }
  }, [availableResources, isMatch, setValue, staticVars]);
}


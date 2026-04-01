"use client";
import { DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import { PromptFieldGroup } from "@/nodes/shared/prompt-field-group";
import { AiPromptGenerator } from "@/nodes/agent/ai-prompt-generator";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { useDetectedVariables } from "@/nodes/shared/use-detected-variables";
import { WorkflowNodeType } from "@/types/workflow";

interface PromptFieldsProps {
  control: FormControl;
  setValue: FormSetValue;
  nodeId?: string;
}

export function Fields({ control, setValue, nodeId }: PromptFieldsProps) {
  const { value: promptText, dynamic, staticVars } = useDetectedVariables({
    control,
    setValue,
  });

  return (
    <div className="space-y-3">
      <PromptFieldGroup
        control={control}
        setValue={setValue}
        value={promptText}
        height={200}
        required
      />
      <AiPromptGenerator setValue={setValue} currentPrompt={promptText} nodeId={nodeId} nodeType={WorkflowNodeType.Prompt} />
      <DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />
    </div>
  );
}

"use client";

import { useWatch } from "react-hook-form";
import { CodeFieldGroup } from "@/nodes/shared/code-field-group";
import { AiPromptGenerator } from "@/nodes/agent/ai-prompt-generator";
import { DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { getScriptEditorLanguage } from "@/nodes/skill/script-utils";
import { useDetectedVariables } from "@/nodes/shared/use-detected-variables";
import { WorkflowNodeType } from "@/types/workflow";

interface ScriptFieldsProps {
  control: FormControl;
  setValue: FormSetValue;
  nodeId?: string;
}

export function Fields({ control, setValue, nodeId }: ScriptFieldsProps) {
  const label: string = useWatch({ control, name: "label" }) ?? "script.ts";
  const { value: promptText, dynamic, staticVars } = useDetectedVariables({
    control,
    setValue,
  });
  const scriptLanguage = getScriptEditorLanguage(label);


  return (
    <div className="space-y-3">
      <CodeFieldGroup
        control={control}
        setValue={setValue}
        value={promptText}
        label="Script"
        htmlId="scriptText"
        height={220}
        language={scriptLanguage}
        editorTitle="Script Editor"
        placeholder="Write Bun-compatible TypeScript or JavaScript here…"
        required
      />
      <AiPromptGenerator setValue={setValue} currentPrompt={promptText} nodeId={nodeId} nodeType={WorkflowNodeType.Script} />
      <DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />
      <div className="rounded-xl border border-sky-800/20 bg-sky-950/10 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
        This node exports as a real Bun script file and attaches to a <span className="font-medium text-zinc-200">skill</span>. Use the node label as the desired filename, such as <span className="font-mono text-sky-300">lint-fix.ts</span>.
      </div>
    </div>
  );
}


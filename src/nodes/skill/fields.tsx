"use client";
import { useCallback, useMemo } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PromptFieldGroup } from "@/nodes/shared/prompt-field-group";
import { AiPromptGenerator } from "@/nodes/agent/ai-prompt-generator";
import { FileCode2, Plus, Sparkles, Trash2 } from "lucide-react";
import { DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue, FormRegister } from "@/nodes/shared/form-types";
import { ConnectedNodesList } from "@/nodes/shared/connected-nodes-list";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { StaticVariableMapping } from "@/nodes/shared/static-variable-mapping";
import { useAutoResourceVariableMapping } from "@/nodes/shared/use-auto-resource-variable-mapping";
import { useDetectedVariables } from "@/nodes/shared/use-detected-variables";
import { useConnectedResources } from "@/nodes/shared/use-connected-resources";
import type { SkillMetadataEntry } from "./types";
import { buildSkillScriptRelativePath, getSkillScriptBaseName, getSkillScriptFileName } from "./script-utils";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isValidSlug = (v: string) => { const t = v.trim(); return t === "" || SLUG_REGEX.test(t); };

interface SkillFieldsProps {
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
  nodeId?: string;
}

export function Fields({ register, control, setValue, nodeId }: SkillFieldsProps) {
  const label: string = useWatch({ control, name: "label" }) ?? "Skill";
  const skillName: string = useWatch({ control, name: "skillName" }) ?? "";
  const {
    value: promptText,
    dynamic,
    staticVars,
  } = useDetectedVariables({ control, setValue });
  const rawVariableMappings = useWatch({ control, name: "variableMappings" });
  const variableMappings = useMemo(
    () => (rawVariableMappings as Record<string, string> | undefined) ?? {},
    [rawVariableMappings],
  );
  const metadata: SkillMetadataEntry[] = useWatch({ control, name: "metadata" }) ?? [];
  const { connectedScripts, availableResources, deleteEdge } = useConnectedResources(nodeId);
  const skillFolder = (skillName.trim() || label.trim() || "skill")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "skill";

  const scriptExamples = connectedScripts.slice(0, 2).map(({ edge, node }) => {
    const fileName = getSkillScriptFileName(node.data);
    return {
      key: `${edge.id}:${node.id}`,
      fileName,
      variableName: getSkillScriptBaseName(node.data),
      relativePath: buildSkillScriptRelativePath(fileName),
    };
  });

  const matchesStaticScriptResource = useCallback(
    (variableName: string, resource: (typeof availableResources)[number]) => {
      if (resource.kind !== "script") return false;

      const lower = variableName.toLowerCase();
      const scriptRef = resource.value.replace(/^script:/, "");
      const fileStem = scriptRef.replace(/\.[^.]+$/, "");
      return fileStem.toLowerCase() === lower || scriptRef.toLowerCase() === lower;
    },
    [],
  );

  useAutoResourceVariableMapping({
    staticVars,
    availableResources,
    variableMappings,
    setValue,
    isMatch: matchesStaticScriptResource,
  });

  const addEntry = () =>
    setValue("metadata" as never, [...metadata, { key: "", value: "" }] as never, { shouldDirty: true });

  const removeEntry = (i: number) =>
    setValue("metadata" as never, metadata.filter((_, idx) => idx !== i) as never, { shouldDirty: true });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="skill-name">
          Skill Name <RequiredIndicator />
        </Label>
        <Input
          id="skill-name"
          placeholder="code-review"
          className={`bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-sm ${!isValidSlug(skillName) ? "border-red-600/60" : ""}`}
          {...register("skillName")}
        />
        <p className="text-[10px] text-zinc-500">Used for the generated skill folder and skill reference name.</p>
        {!isValidSlug(skillName) && <p className="text-[10px] text-red-400">Use lowercase letters, numbers, and hyphens only.</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="skill-description">
          Description <RequiredIndicator />
        </Label>
        <Controller
          name={"description" as never}
          control={control}
          render={({ field }) => (
            <Textarea
              id="skill-description"
              placeholder="Describe what this skill does"
              className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 min-h-18 resize-none text-sm"
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {/* Prompt */}
      <PromptFieldGroup
        control={control}
        setValue={setValue}
        value={promptText}
        label="Prompt"
        htmlId="skill-prompt"
        height={160}
        placeholder="The content of the skill goes here"
        required
      />
      <AiPromptGenerator setValue={setValue} currentPrompt={promptText} nodeId={nodeId} nodeType="skill" />
      <DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />

      <StaticVariableMapping
        staticVars={staticVars}
        variableMappings={variableMappings}
        availableResources={availableResources}
        setValue={setValue}
      />

      <div className="space-y-2 rounded-2xl border border-sky-800/30 bg-sky-950/10 p-3">
        <div className="flex items-center gap-2 text-sky-300">
          <FileCode2 size={14} className="shrink-0" />
          <span className="text-xs font-semibold">Bun script guide</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          Connect <span className="font-medium text-zinc-200">Script</span> nodes to this skill. Their label becomes the exported Bun filename, and writing a matching <code className="font-mono text-amber-300">{"{{script-name}}"}</code> variable in this skill auto-maps to the script.
        </p>
        {scriptExamples.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-zinc-700/40 bg-zinc-950/40 p-2.5">
            {scriptExamples.map((script) => (
              <div key={script.key} className="space-y-1.5 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                  <span className="rounded-md border border-sky-800/40 bg-sky-950/40 px-1.5 py-0.5 font-mono text-sky-300">{script.fileName}</span>
                  <span className="font-mono text-amber-300">{`{{${script.variableName}}}`}</span>
                </div>
                <code className="block overflow-x-auto rounded-md bg-black/30 px-2 py-1.5 text-[11px] text-zinc-300">
                  {`bun run .claude/skills/${skillFolder}/${script.relativePath}`}
                </code>
              </div>
            ))}
          </div>
        ) : (
          <code className="block overflow-x-auto rounded-md bg-black/30 px-2 py-1.5 text-[11px] text-zinc-400">
            {`bun run .opencode/skills/${skillFolder}/scripts/<script-name>.ts`}
          </code>
        )}
        <div className="flex items-start gap-2 rounded-xl border border-violet-800/20 bg-violet-950/10 px-2.5 py-2 text-[11px] leading-relaxed text-violet-200/80">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-violet-400" />
          <span>Use the connected script node’s AI generate/edit controls to create the script content, then attach it here for Bun export and variable mapping.</span>
        </div>
      </div>

      <ConnectedNodesList variant="script" items={connectedScripts} onDeleteEdge={deleteEdge} />

      {/* Metadata */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>Metadata</Label>
            <span className="text-[10px] text-zinc-600">e.g. <span className="font-mono">language: typescript</span></span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addEntry}
            className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-100 gap-1 self-start"
          >
            <Plus size={12} />
            Add
          </Button>
        </div>
        {metadata.length === 0 && (
          <p className="text-xs text-zinc-600 italic">No metadata entries.</p>
        )}
        <div className="space-y-2">
          {metadata.map((entry, i) => {
            const keyOk = isValidSlug(entry.key ?? "");
            const valOk = isValidSlug(entry.value ?? "");
            return (
              <div key={i} className="flex items-start gap-1.5">
                <div className="flex flex-col flex-1">
                  <Controller
                    name={`metadata.${i}.key` as never}
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="key"
                        className={`bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-xs h-8 ${!keyOk ? "border-red-600/60" : ""}`}
                        onBlur={(e) => field.onChange(e.target.value.trim())}
                      />
                    )}
                  />
                  {!keyOk && <p className="text-[10px] text-red-400 mt-0.5 px-1">lowercase, digits, hyphens only</p>}
                </div>
                <div className="flex flex-col flex-1">
                  <Controller
                    name={`metadata.${i}.value` as never}
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="value"
                        className={`bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-xs h-8 ${!valOk ? "border-red-600/60" : ""}`}
                        onBlur={(e) => field.onChange(e.target.value.trim())}
                      />
                    )}
                  />
                  {!valOk && <p className="text-[10px] text-red-400 mt-0.5 px-1">lowercase, digits, hyphens only</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEntry(i)}
                  className="h-8 w-8 shrink-0 text-zinc-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

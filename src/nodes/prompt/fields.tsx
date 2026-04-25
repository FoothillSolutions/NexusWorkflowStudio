"use client";
import { useEffect, useState } from "react";
import { DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import { PromptFieldGroup } from "@/nodes/shared/prompt-field-group";
import { AiPromptGenerator } from "@/nodes/agent/ai-prompt-generator";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { useDetectedVariables } from "@/nodes/shared/use-detected-variables";
import { WorkflowNodeType } from "@/types/workflow";
import { useKnowledgeStore } from "@/store/knowledge-store";
import { useWatch } from "react-hook-form";
import { Brain, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptFieldsProps {
  control: FormControl;
  setValue: FormSetValue;
  nodeId?: string;
}

function BrainDocPicker({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const docs = useKnowledgeStore((s) => s.docs);
  const [search, setSearch] = useState("");

  const filtered = docs.filter(
    (d) =>
      d.status !== "archived" &&
      (search === "" ||
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))),
  );

  return (
    <div className="space-y-1.5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-500">
          Brain Library
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200"
        >
          <X size={12} />
        </button>
      </div>

      {docs.length === 0 ? (
        <p className="py-2 text-center text-xs text-zinc-600">
          No Brain documents yet — create some in the Brain panel first.
        </p>
      ) : (
        <>
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Search docs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-full rounded-lg border border-zinc-700/50 bg-zinc-900/60 pl-7 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-zinc-600"
            />
          </div>

          <div className="max-h-44 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="py-2 text-center text-xs text-zinc-600">No results</p>
            )}
            {filtered.map((doc) => {
              const isSelected = doc.id === selectedId;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onSelect(doc.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                    isSelected
                      ? "border border-sky-500/30 bg-sky-500/10 text-sky-200"
                      : "border border-transparent text-zinc-300 hover:bg-zinc-800/60",
                  )}
                >
                  <Brain size={11} className={isSelected ? "text-sky-400" : "text-zinc-500"} />
                  <span className="flex-1 truncate">{doc.title}</span>
                  {isSelected && <span className="text-sky-400">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function Fields({ control, setValue, nodeId }: PromptFieldsProps) {
  const { value: promptText, dynamic, staticVars } = useDetectedVariables({
    control,
    setValue,
  });

  const brainDocId = useWatch({ control, name: "brainDocId" }) as string | null | undefined;
  const [pickerOpen, setPickerOpen] = useState(false);

  // Live-sync promptText from brain doc while panel is open
  const brainDocs = useKnowledgeStore((s) => s.docs);
  useEffect(() => {
    if (!brainDocId) return;
    const doc = brainDocs.find((d) => d.id === brainDocId);
    if (doc) {
      setValue("promptText" as never, doc.content as never, { shouldDirty: true });
    }
  }, [brainDocId, brainDocs, setValue]);

  const linkedDoc = brainDocId ? brainDocs.find((d) => d.id === brainDocId) : null;

  const handleSelect = (id: string) => {
    const doc = brainDocs.find((d) => d.id === id);
    if (doc) {
      setValue("brainDocId" as never, id as never, { shouldDirty: true });
      setValue("promptText" as never, doc.content as never, { shouldDirty: true });
    }
    setPickerOpen(false);
  };

  const handleUnlink = () => {
    setValue("brainDocId" as never, null as never, { shouldDirty: true });
    setPickerOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Brain source indicator / picker trigger */}
      {linkedDoc ? (
        <div className="flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/8 px-2.5 py-2">
          <Brain size={13} className="shrink-0 text-sky-400" />
          <span className="flex-1 truncate text-xs text-sky-200">{linkedDoc.title}</span>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="text-[10px] text-sky-500 hover:text-sky-300"
          >
            change
          </button>
          <button
            type="button"
            onClick={handleUnlink}
            className="text-zinc-500 hover:text-red-400"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
            pickerOpen
              ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
              : "border-dashed border-zinc-700/60 text-zinc-500 hover:border-sky-500/30 hover:text-sky-400",
          )}
        >
          <Brain size={12} />
          Link from Brain
        </button>
      )}

      {pickerOpen && (
        <BrainDocPicker
          selectedId={brainDocId ?? null}
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}

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

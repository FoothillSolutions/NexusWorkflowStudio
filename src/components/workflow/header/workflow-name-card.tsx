"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { TEXT_PRIMARY } from "@/lib/theme";
import type { GenerationTargetId } from "@/lib/generation-targets";
import { getGenerationTargetVisuals } from "@/lib/generation-target-visuals";
import { PencilLine } from "lucide-react";

interface WorkflowNameCardProps {
  name: string;
  setName: (name: string) => void;
  isDirty: boolean;
  needsSave: boolean;
  activeWorkflowId: string | null;
  generationTargetLabel: string;
  generationTargetId: GenerationTargetId;
}

export function WorkflowNameCard({
  name,
  setName,
  isDirty,
  needsSave,
  activeWorkflowId,
  generationTargetLabel,
  generationTargetId,
}: WorkflowNameCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  const handleNameBlur = () => setIsEditingName(false);

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      setIsEditingName(false);
    }
  };

  const statusBadge = needsSave ? (
    <Badge
      variant="outline"
      className="rounded-full border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300"
    >
      {isDirty ? "Modified" : "Draft"}
    </Badge>
  ) : activeWorkflowId ? (
    <Badge
      variant="outline"
      className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300"
    >
      Saved
    </Badge>
  ) : null;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-900/80 px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:inline">
          Workflow
        </span>

        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className={`nexus-allow-text-selection ${TEXT_PRIMARY} min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-zinc-600 sm:text-[15px]`}
            placeholder="Untitled workflow"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
          >
            <span className={`${TEXT_PRIMARY} min-w-0 flex-1 truncate text-sm font-medium sm:text-[15px]`}>
              {name}
            </span>
            <PencilLine className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
          </button>
        )}

        <div className="hidden h-4 w-px shrink-0 bg-zinc-800/80 lg:block" />

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {statusBadge}
          <Badge
            variant="outline"
            className={`hidden rounded-full px-2 py-0 text-[10px] font-medium xl:inline-flex ${getGenerationTargetVisuals(generationTargetId).badgeClass}`}
          >
            {generationTargetLabel}
          </Badge>
        </div>
      </div>
    </div>
  );
}


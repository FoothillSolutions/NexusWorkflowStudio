"use client";

import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkflowEnhancementSuggestion } from "@/store/workflow-gen";

interface SuggestionCardProps {
  suggestion: WorkflowEnhancementSuggestion;
  onApply: (id: string) => void;
  disabled?: boolean;
}

export function SuggestionCard({ suggestion, onApply, disabled }: SuggestionCardProps) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-3 transition-colors hover:border-violet-700/40 hover:bg-zinc-900/80">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-sm font-medium text-zinc-100">{suggestion.title}</div>
        <div className="text-xs leading-relaxed text-zinc-400">{suggestion.description}</div>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() => onApply(suggestion.id)}
        className="shrink-0 bg-violet-600 text-white hover:bg-violet-500"
      >
        <Wand2 className="h-3.5 w-3.5" />
        <span>Apply</span>
      </Button>
    </div>
  );
}

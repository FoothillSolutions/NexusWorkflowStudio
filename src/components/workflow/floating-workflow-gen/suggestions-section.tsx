"use client";

import { useCallback } from "react";
import { AlertCircle, ArrowLeft, Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkflowGenStore } from "@/store/workflow-gen";
import { SuggestionCard } from "./suggestion-card";
import { SuggestionCardSkeleton } from "./suggestion-card-skeleton";

const LOADING_SKELETON_COUNT = 4;

export function FloatingWorkflowGenSuggestionsSection() {
  const status = useWorkflowGenStore((s) => s.suggestionsStatus);
  const suggestions = useWorkflowGenStore((s) => s.suggestions);
  const error = useWorkflowGenStore((s) => s.suggestionsError);
  const close = useWorkflowGenStore((s) => s.closeSuggestions);
  const refetch = useWorkflowGenStore((s) => s.fetchSuggestions);
  const resetSuggestions = useWorkflowGenStore((s) => s.resetSuggestions);
  const applySuggestion = useWorkflowGenStore((s) => s.applySuggestion);

  const onApply = useCallback(
    (id: string) => {
      const target = suggestions.find((s) => s.id === id);
      if (target) void applySuggestion(target);
    },
    [suggestions, applySuggestion],
  );

  const onRegenerate = useCallback(() => {
    resetSuggestions();
    void refetch();
  }, [resetSuggestions, refetch]);

  const isLoading = status === "loading";
  const canRegenerate = status === "done" || status === "error";

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-200 transition-colors"
            title="Back"
          >
            <ArrowLeft size={13} />
          </button>
          <Lightbulb size={13} className="text-violet-400 shrink-0" />
          <span className="text-xs font-medium text-zinc-200 truncate">
            Suggested enhancements
          </span>
        </div>
        {canRegenerate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            className="h-6 gap-1 px-2 text-[10px] text-zinc-400 hover:text-zinc-100"
          >
            <RefreshCw size={10} />
            Regenerate
          </Button>
        )}
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: LOADING_SKELETON_COUNT }).map((_, i) => (
            <SuggestionCardSkeleton key={i} index={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-800/30 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium mb-0.5">Couldn&apos;t generate suggestions</div>
            <div className="text-amber-300/80 break-words">{error ?? "Unknown error."}</div>
          </div>
        </div>
      )}

      {/* Done — list */}
      {status === "done" && suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} onApply={onApply} />
          ))}
        </div>
      )}

      {/* Done — empty */}
      {status === "done" && suggestions.length === 0 && (
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-4 text-center text-xs text-zinc-500">
          No suggestions available for this workflow.
        </div>
      )}
    </div>
  );
}

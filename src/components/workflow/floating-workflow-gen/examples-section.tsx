import { BotMessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { EXAMPLE_ROW_HEIGHT_PX, VISIBLE_EXAMPLE_COUNT } from "./constants";

interface FloatingWorkflowGenExamplesSectionProps {
  visibleExamples: string[];
  showShimmers: boolean;
  aiExamplesStatus: "idle" | "loading" | "done" | "error";
  hasRefresh: boolean;
  onRefresh: () => void;
  onExampleClick: (example: string) => void;
}

export function FloatingWorkflowGenExamplesSection({
  visibleExamples,
  showShimmers,
  aiExamplesStatus,
  hasRefresh,
  onRefresh,
  onExampleClick,
}: FloatingWorkflowGenExamplesSectionProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5">
          Examples
          {aiExamplesStatus === "loading" && (
            <Loader2 size={9} className="text-violet-400 animate-spin" />
          )}
        </Label>
        {hasRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-violet-400 transition-colors"
            title="Generate new AI examples"
          >
            <RefreshCw size={9} />
            Refresh
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-1">
        {showShimmers && (
          Array.from({ length: VISIBLE_EXAMPLE_COUNT }).map((_, index) => (
            <div
              key={`shimmer-${index}`}
              className="rounded-lg px-2.5 border border-zinc-800/40 overflow-hidden"
              style={{ height: EXAMPLE_ROW_HEIGHT_PX }}
            >
              <div className="flex flex-col justify-center gap-1.5 h-full">
                <div
                  className="h-2.5 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
                  style={{ width: `${85 - index * 10}%`, backgroundSize: "200% 100%" }}
                />
                <div
                  className="h-2.5 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
                  style={{ width: `${70 - index * 8}%`, backgroundSize: "200% 100%", animationDelay: `${0.15 * (index + 1)}s` }}
                />
                <div
                  className="h-2.5 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
                  style={{ width: `${55 - index * 5}%`, backgroundSize: "200% 100%", animationDelay: `${0.3 * (index + 1)}s` }}
                />
              </div>
            </div>
          ))
        )}

        {!showShimmers && visibleExamples.map((example, index) => (
          <button
            key={`ai-example-${index}`}
            type="button"
            onClick={() => onExampleClick(example)}
            className="text-left text-[11px] leading-4 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg px-2.5 transition-colors border border-transparent hover:border-zinc-700/50 animate-in fade-in-50 duration-300 overflow-hidden"
            style={{
              height: EXAMPLE_ROW_HEIGHT_PX,
              display: "flex",
              alignItems: "flex-start",
              paddingTop: 6,
              paddingBottom: 0,
            }}
          >
            <BotMessageSquare size={9} className="text-violet-400/70 shrink-0 mt-0.75 mr-1.5" />
            <span
              className="overflow-hidden"
              style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
            >
              {example}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}


import { Loader2 } from "lucide-react";
import type { WorkflowGenMode } from "@/store/workflow-gen";

interface FloatingWorkflowGenCollapsedStatusProps {
  isStreaming: boolean;
  isDone: boolean;
  isError: boolean;
  tokenCount: number;
  parsedNodeCount: number;
  mode: WorkflowGenMode;
}

export function FloatingWorkflowGenCollapsedStatus({
  isStreaming,
  isDone,
  isError,
  tokenCount,
  parsedNodeCount,
  mode,
}: FloatingWorkflowGenCollapsedStatusProps) {
  const streamingVerb = mode === "edit" ? "Editing" : "Generating";
  return (
    <div className="px-3.5 py-2 flex items-center gap-2 text-[11px] text-zinc-400">
      {isStreaming ? (
        <>
          <Loader2 size={11} className="text-violet-400 animate-spin" />
          {streamingVerb}… ~{tokenCount} tokens · {parsedNodeCount} nodes
        </>
      ) : isDone ? (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Complete — ~{tokenCount} tokens · {parsedNodeCount} nodes
        </>
      ) : isError ? (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
          Error
        </>
      ) : (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-600" />
          Ready
        </>
      )}
    </div>
  );
}


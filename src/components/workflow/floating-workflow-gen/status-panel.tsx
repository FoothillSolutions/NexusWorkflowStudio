import { CheckCircle2, Loader2, Workflow, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingWorkflowGenStatusPanelProps {
  isStreaming: boolean;
  isDone: boolean;
  isError: boolean;
  status: "idle" | "creating-session" | "streaming" | "done" | "error";
  parsedNodeCount: number;
  error: string | null;
  streamedText: string;
}

/** Maximum number of trailing raw streamed characters shown in the dev-only preview. */
const RAW_OUTPUT_PREVIEW_CHARACTER_LIMIT = 1500;

export function FloatingWorkflowGenStatusPanel({
  isStreaming,
  isDone,
  isError,
  status,
  parsedNodeCount,
  error,
  streamedText,
}: FloatingWorkflowGenStatusPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        isStreaming && "border-violet-700/30 bg-violet-950/10",
        isDone && "border-emerald-700/30 bg-emerald-950/10",
        isError && "border-red-700/30 bg-red-950/10",
      )}
    >
      <div className="flex items-center gap-2">
        {isStreaming && (
          <>
            <Loader2 size={12} className="text-violet-400 animate-spin" />
            <span className="text-xs text-violet-300">
              {status === "creating-session"
                ? "Creating AI session…"
                : "Streaming nodes to canvas…"}
            </span>
          </>
        )}
        {isDone && (
          <>
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span className="text-xs text-emerald-300">Workflow generated!</span>
          </>
        )}
        {isError && (
          <>
            <XCircle size={12} className="text-red-400" />
            <span className="text-xs text-red-300">Generation failed</span>
          </>
        )}
      </div>

      {(isStreaming || isDone) && (
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Workflow size={10} />
            {parsedNodeCount} nodes
          </span>
        </div>
      )}

      {isError && error && (
        <p className="text-[10px] text-red-400/80 bg-red-950/20 rounded px-2 py-1 font-mono break-all">
          {error}
        </p>
      )}

      {process.env.NODE_ENV === "development" && isStreaming && streamedText && (
        <details className="group">
          <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400 select-none">
            Show raw output…
          </summary>
          <pre className="custom-scroll mt-1.5 text-[9px] text-zinc-600 bg-zinc-950/50 rounded p-1.5 max-h-24 overflow-auto font-mono whitespace-pre-wrap break-all">
            {streamedText.slice(-RAW_OUTPUT_PREVIEW_CHARACTER_LIMIT)}
          </pre>
        </details>
      )}
    </div>
  );
}


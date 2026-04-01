import { CheckCircle2, FolderOpen, Loader2, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingWorkflowGenProjectContextToggleProps {
  isStreaming: boolean;
  useProjectContext: boolean;
  projectContextStatus: "idle" | "loading" | "done" | "error";
  currentProjectName: string | null;
  onToggle: () => void;
  onRetry: () => void;
}

export function FloatingWorkflowGenProjectContextToggle({
  isStreaming,
  useProjectContext,
  projectContextStatus,
  currentProjectName,
  onToggle,
  onRetry,
}: FloatingWorkflowGenProjectContextToggleProps) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={isStreaming}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-all border",
          useProjectContext
            ? "bg-violet-950/30 border-violet-700/40 text-violet-300"
            : "bg-zinc-800/30 border-zinc-700/30 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600/40",
          isStreaming && "opacity-50 cursor-not-allowed",
        )}
      >
        <FolderOpen
          size={13}
          className={cn(
            "shrink-0 transition-colors",
            useProjectContext ? "text-violet-400" : "text-zinc-600",
          )}
        />
        <div className="flex-1 min-w-0 text-left">
          <span className="font-medium">Use project folder as context</span>
          {currentProjectName && (
            <span
              className={cn(
                "ml-1.5 text-[10px]",
                useProjectContext ? "text-violet-400/60" : "text-zinc-600",
              )}
            >
              {currentProjectName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {useProjectContext && projectContextStatus === "loading" && (
            <Loader2 size={10} className="text-violet-400 animate-spin" />
          )}
          {useProjectContext && projectContextStatus === "done" && (
            <CheckCircle2 size={10} className="text-emerald-400" />
          )}
          {useProjectContext && projectContextStatus === "error" && (
            <XCircle size={10} className="text-red-400" />
          )}
          <div
            className={cn(
              "w-7 h-4 rounded-full transition-colors relative",
              useProjectContext ? "bg-violet-600" : "bg-zinc-700",
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                useProjectContext ? "left-3.5" : "left-0.5",
              )}
            />
          </div>
        </div>
      </button>
      {useProjectContext && projectContextStatus === "error" && (
        <button
          type="button"
          onClick={onRetry}
          className="text-[10px] text-red-400/70 hover:text-red-300 transition-colors flex items-center gap-1 px-2.5"
        >
          <RefreshCw size={8} />
          Failed to load file tree — click to retry
        </button>
      )}
    </div>
  );
}


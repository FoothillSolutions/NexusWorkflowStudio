import { RotateCcw, Sparkles, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingWorkflowGenActionsRowProps {
  isConnected: boolean;
  isStreaming: boolean;
  isDone: boolean;
  isError: boolean;
  canGenerate: boolean;
  onCancel: () => void;
  onReset: () => void;
  onGenerate: () => void | Promise<void>;
}

export function FloatingWorkflowGenActionsRow({
  isConnected,
  isStreaming,
  isDone,
  isError,
  canGenerate,
  onCancel,
  onReset,
  onGenerate,
}: FloatingWorkflowGenActionsRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <div className="text-[10px] text-zinc-600">
        {isConnected ? "Connected" : "Not connected"}
      </div>
      <div className="flex items-center gap-1.5">
        {isStreaming && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-200 gap-1 h-7 text-xs px-2"
          >
            <StopCircle size={12} />
            Cancel
          </Button>
        )}
        {(isError || isDone) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-zinc-400 hover:text-zinc-200 gap-1 h-7 text-xs px-2"
          >
            <RotateCcw size={12} />
            {isDone ? "New" : "Retry"}
          </Button>
        )}
        {!isStreaming && !isDone && (
          <Button
            size="sm"
            onClick={() => void onGenerate()}
            disabled={!canGenerate}
            className="bg-violet-600 hover:bg-violet-500 text-white gap-1 h-7 text-xs px-3 shadow-sm disabled:opacity-50"
          >
            <Sparkles size={12} />
            Generate
          </Button>
        )}
      </div>
    </div>
  );
}


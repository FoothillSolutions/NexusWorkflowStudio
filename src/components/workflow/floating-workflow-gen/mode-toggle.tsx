import { Pencil, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowGenMode } from "@/store/workflow-gen";

interface FloatingWorkflowGenModeToggleProps {
  mode: WorkflowGenMode;
  onChange: (mode: WorkflowGenMode) => void;
  disabled?: boolean;
  editDisabled?: boolean;
  editDisabledReason?: string;
}

export function FloatingWorkflowGenModeToggle({
  mode,
  onChange,
  disabled,
  editDisabled,
  editDisabledReason,
}: FloatingWorkflowGenModeToggleProps) {
  const generateActive = mode === "generate";
  const editActive = mode === "edit";
  const editLocked = Boolean(editDisabled);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-1">
        <button
          type="button"
          onClick={() => onChange("generate")}
          disabled={disabled}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
            generateActive
              ? "bg-violet-600/90 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <Sparkles size={12} className={generateActive ? "text-white" : "text-violet-400"} />
          Generate
        </button>
        <button
          type="button"
          onClick={() => onChange("edit")}
          disabled={disabled || editLocked}
          title={editLocked ? editDisabledReason : undefined}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
            editActive
              ? "bg-violet-600/90 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40",
            (disabled || editLocked) && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-zinc-400",
          )}
        >
          <Pencil size={12} className={editActive ? "text-white" : "text-violet-400"} />
          Edit
        </button>
      </div>
    </div>
  );
}

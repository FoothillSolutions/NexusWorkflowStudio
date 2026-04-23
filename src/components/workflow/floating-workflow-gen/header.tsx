import { ChevronDown, ChevronUp, GripHorizontal, Sparkles, X } from "lucide-react";
import type { WorkflowGenMode } from "@/store/workflow-gen";

interface FloatingWorkflowGenHeaderProps {
  collapsed: boolean;
  isStreaming: boolean;
  isDone: boolean;
  parsedNodeCount: number;
  mode: WorkflowGenMode;
  onToggleCollapsed: () => void;
  onClose: () => void;
  onDragStart: (event: React.MouseEvent) => void;
}

export function FloatingWorkflowGenHeader({
  collapsed,
  isStreaming,
  isDone,
  parsedNodeCount,
  mode,
  onToggleCollapsed,
  onClose,
  onDragStart,
}: FloatingWorkflowGenHeaderProps) {
  const title = mode === "edit" ? "Edit Workflow with AI" : "Generate Workflow with AI";
  return (
    <div
      className="flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 bg-violet-950/30 border-violet-800/20 rounded-t-2xl cursor-grab active:cursor-grabbing select-none"
      onMouseDown={onDragStart}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 min-w-0">
        <GripHorizontal size={14} className="text-zinc-600 shrink-0" />
        <Sparkles size={14} className="text-violet-400 shrink-0" />
        <div className="min-w-0">
          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            {title}
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 leading-none">
              Beta
            </span>
          </span>
          {(isStreaming || isDone) && (
            <span className={isDone ? "text-[10px] text-emerald-400/80 block" : "text-[10px] text-violet-400/80 block"}>
              {parsedNodeCount} nodes
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand" : "Collapse"}
          className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >
          {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}


import { ArrowLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectButton, HelpMenu, LibraryToggleButton } from "../shared-header-actions";

interface BreadcrumbEntry {
  nodeId: string;
  label: string;
}

interface SubWorkflowCanvasHeaderProps {
  workflowName: string;
  subWorkflowStack: BreadcrumbEntry[];
  nodeCount: number;
  edgeCount: number;
  onBack: () => void;
  onNavigateToRoot: () => void;
  onNavigateToBreadcrumb: (index: number) => void;
}

export function SubWorkflowCanvasHeader({
  workflowName,
  subWorkflowStack,
  nodeCount,
  edgeCount,
  onBack,
  onNavigateToRoot,
  onNavigateToBreadcrumb,
}: SubWorkflowCanvasHeaderProps) {
  return (
    <div className="nexus-no-select shrink-0 border-b border-zinc-800 bg-zinc-900/90 px-4 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 shrink-0 gap-1.5 px-2 text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft size={14} />
          Back
        </Button>
        <div className="h-4 w-px shrink-0 bg-zinc-700" />

        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          <button
            type="button"
            onClick={onNavigateToRoot}
            className="max-w-35 shrink-0 truncate text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            {workflowName}
          </button>

          {subWorkflowStack.map((entry, index) => {
            const isLast = index === subWorkflowStack.length - 1;

            return (
              <div key={`${index}-${entry.nodeId}`} className="flex min-w-0 items-center gap-1">
                <ChevronRight size={12} className="shrink-0 text-zinc-600" />
                {isLast ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <LayoutDashboard size={12} className="shrink-0 text-purple-400" />
                    <span className="truncate text-sm font-medium text-zinc-200">{entry.label}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigateToBreadcrumb(index)}
                    className="max-w-30 truncate text-sm text-zinc-400 transition-colors hover:text-zinc-100"
                  >
                    {entry.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="font-mono text-[10px] text-zinc-500">{nodeCount} nodes</span>
          <span className="text-[10px] text-zinc-500">·</span>
          <span className="font-mono text-[10px] text-zinc-500">{edgeCount} edges</span>
          <div className="mx-1 h-4 w-px bg-zinc-700" />
          <LibraryToggleButton variant="compact" />
          <ConnectButton variant="compact" />
          <HelpMenu />
        </div>
      </div>
    </div>
  );
}


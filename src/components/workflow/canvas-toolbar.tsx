"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";
import type { CanvasMode } from "@/store/workflow-store-types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Hand, MousePointer2, Spline, LayoutDashboard, ScanSearch } from "lucide-react";
import { TEXT_MUTED } from "@/lib/theme";
import { MOD, SHIFT } from "@/lib/platform";

export default function CanvasToolbar() {
  const { fitView } = useReactFlow();
  const canvasMode = useWorkflowStore((s) => s.canvasMode);
  const setCanvasMode = useWorkflowStore((s) => s.setCanvasMode);
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);
  const toggleEdgeStyle = useWorkflowStore((s) => s.toggleEdgeStyle);

  const handleAutoFit = useCallback(() => {
    void fitView({ duration: 300, maxZoom: 0.85, padding: 0.3 });
  }, [fitView]);

  const handleAutoLayout = () => {
    window.dispatchEvent(new CustomEvent("nexus:auto-layout"));
  };

  const modeItems: { mode: CanvasMode; icon: typeof Hand; label: string; shortcut: string }[] = [
    { mode: "hand", icon: Hand, label: "Hand Tool", shortcut: "H" },
    { mode: "selection", icon: MousePointer2, label: "Selection Tool", shortcut: "V" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="nexus-no-select absolute top-4 left-16 z-30 flex items-center gap-1.5">
        {/* Mode toggle group */}
        <div className="flex items-center rounded-xl bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-sm shadow-lg overflow-hidden">
          {modeItems.map(({ mode, icon: Icon, label, shortcut }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCanvasMode(mode)}
                  className={`h-9 w-9 flex items-center justify-center transition-all duration-150 cursor-pointer ${
                    canvasMode === mode
                      ? "bg-zinc-700 text-zinc-100"
                      : `${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800/80`
                  }`}
                >
                  <Icon size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {label} <kbd className="ml-1 text-[10px] opacity-60">{shortcut}</kbd>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Edge style toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleEdgeStyle}
              className={`h-9 w-9 rounded-xl bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-sm shadow-lg transition-all duration-150 cursor-pointer ${
                edgeStyle === "smoothstep"
                  ? "text-zinc-100 bg-zinc-700/80"
                  : `${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800/80`
              }`}
            >
              <Spline size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {edgeStyle === "bezier" ? "Switch to Smooth Step" : "Switch to Bezier"} connectors
          </TooltipContent>
        </Tooltip>

        {/* Auto-layout button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAutoFit}
              className={`h-9 w-9 rounded-xl bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-sm shadow-lg ${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800/80 transition-all duration-150 cursor-pointer`}
            >
              <ScanSearch size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Auto-fit canvas
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAutoLayout}
              className={`h-9 w-9 rounded-xl bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-sm shadow-lg ${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800/80 transition-all duration-150 cursor-pointer`}
            >
              <LayoutDashboard size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Auto-layout <kbd className="ml-1 text-[10px] opacity-60">{MOD}+{SHIFT}+L</kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}


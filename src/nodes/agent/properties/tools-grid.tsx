"use client";

import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolsGridProps {
  tools: readonly string[];
  disabledTools: string[];
  isLoading: boolean;
  isStatic: boolean;
  onToggle: (tool: string) => void;
}

export function ToolsGrid({ tools, disabledTools, isLoading, isStatic, onToggle }: ToolsGridProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          Tools
          {!isStatic && !isLoading && (
            <span className="text-[9px] font-medium text-violet-400/70 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full leading-none">
              dynamic
            </span>
          )}
        </Label>
        <div className="flex items-center gap-1.5">
          {isLoading && <Loader2 size={10} className="animate-spin text-zinc-500" />}
          <span className="text-[10px] text-zinc-500 tabular-nums">
            {disabledTools.length === 0 ? "All enabled" : `${disabledTools.length} disabled`}
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 p-2.5">
        <div className="flex flex-wrap gap-1.5">
          {tools.map((tool) => {
            const isDisabled = disabledTools.includes(tool);
            return (
              <button
                key={tool}
                type="button"
                onClick={() => onToggle(tool)}
                title={tool}
                className={cn(
                  "inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all duration-150 whitespace-nowrap select-none",
                  isDisabled
                    ? "bg-red-950/40 border-red-900/40 text-red-400/80 hover:bg-red-950/60"
                    : "bg-zinc-800/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/60 hover:border-zinc-600/60",
                )}
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
                  isDisabled ? "bg-red-500/70" : "bg-emerald-500/70",
                )} />
                <span className={cn(isDisabled && "line-through decoration-red-500/40")}>
                  {tool}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


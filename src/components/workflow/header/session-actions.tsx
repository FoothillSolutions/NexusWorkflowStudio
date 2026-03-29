"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TEXT_MUTED } from "@/lib/theme";
import { Sparkles } from "lucide-react";
import { ConnectButton } from "../shared-header-actions";
import { ActionRail } from "./primitives";

interface HeaderSessionActionsProps {
  isOpenCodeConnected: boolean;
  isWorkflowGenOpen: boolean;
  onToggleWorkflowGen: () => void;
}

export function HeaderSessionActions({
  isOpenCodeConnected,
  isWorkflowGenOpen,
  onToggleWorkflowGen,
}: HeaderSessionActionsProps) {
  return (
    <ActionRail>
      <ConnectButton variant="compact" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleWorkflowGen}
            disabled={!isOpenCodeConnected}
            className={`h-8 rounded-lg px-2.5 text-xs disabled:opacity-40 ${
              isWorkflowGenOpen
                ? "bg-violet-500/15 text-violet-300 hover:bg-violet-500/20"
                : `${TEXT_MUTED} hover:bg-zinc-800/80 hover:text-violet-300`
            }`}
          >
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="hidden sm:inline">AI Generate</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Generate a workflow from a description <kbd className="ml-1 text-[10px] opacity-60">Ctrl+Alt+A</kbd>
        </TooltipContent>
      </Tooltip>
    </ActionRail>
  );
}


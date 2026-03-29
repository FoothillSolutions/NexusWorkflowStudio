"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GENERATION_TARGETS,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import { Check, ChevronDown, Cpu } from "lucide-react";

interface HeaderGenerateMenuProps {
  generateTarget: GenerationTargetId;
  onOpenGenerateDialog: (target: GenerationTargetId) => void;
}

export function HeaderGenerateMenu({
  generateTarget,
  onOpenGenerateDialog,
}: HeaderGenerateMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-8 rounded-xl bg-emerald-600/90 px-3 text-xs font-medium text-white shadow-sm hover:bg-emerald-500"
          title="Choose a target and export generated workflow artifacts"
        >
          <Cpu className="h-4 w-4" />
          Generate
          <ChevronDown className="h-3 w-3 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {GENERATION_TARGETS.map((target) => {
          const isSelected = generateTarget === target.id;

          return (
            <DropdownMenuItem
              key={target.id}
              onClick={() => onOpenGenerateDialog(target.id)}
              className="py-2"
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-md ${
                  isSelected ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {isSelected ? <Check className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-100">{target.label}</div>
                <div className="text-xs text-zinc-500">{target.rootDir}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


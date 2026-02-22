"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseNodeProps {
  children?: React.ReactNode;
  accentHex: string;
  selected?: boolean;
  label: string;
  type: string;
  icon: LucideIcon;
}

export function BaseNode({
  children,
  accentHex,
  selected,
  label,
  type,
  icon: Icon,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        "flex flex-col min-w-[220px] max-w-[280px] rounded-lg bg-zinc-900 transition-shadow duration-200",
        "border border-zinc-700/50 shadow-md",
        selected && "border-zinc-500 ring-1 ring-zinc-500/50"
      )}
      style={{ borderTopColor: accentHex, borderTopWidth: "3px" }}
    >

      {/* Header */}
      <div className="flex flex-col px-3 py-2.5 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: accentHex }} className="shrink-0" />
          <span className="text-sm font-medium text-zinc-100 truncate">
            {label}
          </span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5 ml-6">
          {type}
        </span>
      </div>

      {/* Body */}
      <div className="p-3 text-sm text-zinc-400">
        {children}
      </div>
    </div>
  );
}

"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BG_SURFACE,
  BORDER_NODE,
  BORDER_SELECTED,
  RING_SELECTED,
  TEXT_PRIMARY,
  TEXT_SUBTLE,
  TEXT_MUTED,
} from "@/lib/theme";

export enum NodeSize {
  Small  = "small",
  Medium = "medium",
  Large  = "large",
  XL     = "xl",
}

const SIZE_CLASSES: Record<NodeSize, string> = {
  [NodeSize.Small]:  "min-w-[160px] max-w-[200px]",
  [NodeSize.Medium]: "min-w-[220px] max-w-[280px]",
  [NodeSize.Large]:  "min-w-[320px] max-w-[380px]",
  [NodeSize.XL]:     "min-w-[400px] max-w-[520px]",
};

/**
 * Layout dimensions (in px) used by the auto-layout algorithm.
 * Width uses the midpoint between min-w and max-w of each size class.
 * Height is an estimate based on typical node content.
 */
export const NODE_SIZE_DIMENSIONS: Record<NodeSize, { width: number; height: number }> = {
  [NodeSize.Small]:  { width: 180, height: 80 },   // (160 + 200) / 2
  [NodeSize.Medium]: { width: 250, height: 100 },   // (220 + 280) / 2
  [NodeSize.Large]:  { width: 350, height: 120 },   // (320 + 380) / 2
  [NodeSize.XL]:     { width: 460, height: 140 },   // (400 + 520) / 2
};

interface BaseNodeProps {
  children?: React.ReactNode;
  accentHex: string;
  selected?: boolean;
  label: string;
  type: string;
  icon: LucideIcon;
  size?: NodeSize;
}

export function BaseNode({
  children,
  accentHex,
  selected,
  label,
  type,
  icon: Icon,
  size = NodeSize.Medium,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        `flex flex-col ${SIZE_CLASSES[size]} rounded-lg ${BG_SURFACE} transition-shadow duration-200`,
        `border ${BORDER_NODE} shadow-md cursor-pointer`,
        selected && `${BORDER_SELECTED} ring-1 ${RING_SELECTED}`
      )}
      style={{ borderTopColor: accentHex, borderTopWidth: "3px" }}
    >
      {/* Header */}
      <div className={`flex flex-col px-3 py-2.5 border-b border-zinc-800/50`}>
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: accentHex }} className="shrink-0" />
          <span className={`text-sm font-medium ${TEXT_PRIMARY} truncate`}>
            {label}
          </span>
        </div>
        <span className={`text-[10px] ${TEXT_SUBTLE} font-mono uppercase tracking-wider mt-0.5 ml-6`}>
          {type}
        </span>
      </div>

      {/* Body */}
      <div className={`p-3 text-sm ${TEXT_MUTED}`}>
        {children}
      </div>
    </div>
  );
}


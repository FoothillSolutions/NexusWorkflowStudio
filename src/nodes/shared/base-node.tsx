"use client";

import { useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowGenStore } from "@/store/workflow-gen-store";
import {
  BG_SURFACE,
  BORDER_NODE,
  BORDER_SELECTED,
  RING_SELECTED,
  TEXT_PRIMARY,
  TEXT_SUBTLE,
  TEXT_MUTED,
} from "@/lib/theme";
import { NodeSize } from "./node-size";

export { NodeSize, NODE_SIZE_DIMENSIONS } from "./node-size";

const SIZE_CLASSES: Record<NodeSize, string> = {
  [NodeSize.Small]:  "min-w-[160px] max-w-[200px]",
  [NodeSize.Medium]: "min-w-[220px] max-w-[280px]",
  [NodeSize.Large]:  "min-w-[320px] max-w-[380px]",
  [NodeSize.XL]:     "min-w-[400px] max-w-[520px]",
};


interface BaseNodeProps {
  children?: React.ReactNode;
  accentHex: string;
  selected?: boolean;
  label: string;
  type: string;
  icon: LucideIcon;
  size?: NodeSize;
  /** The React Flow node ID — used to check entrance animation state */
  nodeId?: string;
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function BaseNode({
  children,
  accentHex,
  selected,
  label,
  type,
  icon: Icon,
  size = NodeSize.Medium,
  nodeId,
  containerProps,
}: BaseNodeProps) {
  const isGlowing = useWorkflowGenStore(
    useCallback((s) => nodeId ? s._glowingNodeIds.includes(nodeId) : false, [nodeId])
  );

  return (
    <div
      {...containerProps}
      className={cn(
        `flex flex-col ${SIZE_CLASSES[size]} rounded-lg ${BG_SURFACE} transition-shadow duration-200`,
        `border ${BORDER_NODE} shadow-md cursor-pointer`,
        selected && `${BORDER_SELECTED} ring-1 ${RING_SELECTED}`,
        isGlowing && "ai-node-glow",
        containerProps?.className
      )}
      style={{ ...containerProps?.style, borderTopColor: accentHex, borderTopWidth: "3px" }}
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

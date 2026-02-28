"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { BRANCH_TRUE, BRANCH_FALSE } from "@/lib/node-colors";
import { ifElseRegistryEntry } from "./constants";
import type { IfElseNodeData, IfElseBranch } from "./types";

const BRANCH_COLORS: Record<number, string> = {
  0: BRANCH_TRUE,  // green for true
  1: BRANCH_FALSE, // red for false
};

const BRANCH_BORDER_STYLE = (color: string) => ({
  borderLeft: `2px solid ${color}`,
  borderTop: "1px solid rgba(63,63,70,0.4)",
  borderRight: "1px solid rgba(63,63,70,0.4)",
  borderBottom: "1px solid rgba(63,63,70,0.4)",
});

export const IfElseNode = memo(function IfElseNode({ data, selected }: NodeProps<Node<IfElseNodeData>>) {
  const { icon, accentHex, displayName } = ifElseRegistryEntry;
  const branches: IfElseBranch[] = data.branches ?? [
    { label: "True", condition: "" },
    { label: "False", condition: "" },
  ];

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
    >
      {/* Evaluation target */}
      {data.evaluationTarget && (
        <div className="text-[11px] text-zinc-400 mb-2 leading-snug truncate">
          {data.evaluationTarget}
        </div>
      )}

      {/* Branch blocks */}
      <div className="flex flex-col gap-1.5">
        {branches.map((branch, i) => {
          const color = BRANCH_COLORS[i] ?? accentHex;
          const handleId = i === 0 ? "true" : "false";
          return (
            <div key={i} className="relative flex items-center gap-2">
              {/* Branch pill with left accent stripe */}
              <div
                className="flex-1 min-w-0 flex flex-col gap-0.5 pl-2.5 pr-2 py-1.5 rounded-md bg-zinc-950/40 overflow-hidden"
                style={BRANCH_BORDER_STYLE(color)}
              >
                <span className="text-[11px] font-medium text-zinc-300 truncate">
                  {branch.label || (i === 0 ? "True" : "False")}
                </span>
                {branch.condition && (
                  <p className="text-[10px] text-zinc-500 leading-tight truncate">
                    {branch.condition}
                  </p>
                )}
              </div>
              {/* Source handle */}
              <Handle
                type="source"
                position={Position.Right}
                id={handleId}
                className="!relative !right-0 !top-0 !transform-none !h-2.5 !w-2.5 !border !border-zinc-700 !rounded-full !shadow-sm"
                style={{ backgroundColor: color }}
              />
            </div>
          );
        })}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!h-2.5 !w-2.5 !border !border-zinc-700 !rounded-full !shadow-sm"
        style={{ backgroundColor: accentHex }}
      />
    </BaseNode>
  );
});

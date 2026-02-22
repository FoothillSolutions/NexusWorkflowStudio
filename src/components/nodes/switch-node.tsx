"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { SwitchNodeData } from "@/types/workflow";
import { HANDLE_CLASS } from "@/lib/theme";

export function SwitchNode({ data, selected }: NodeProps<Node<SwitchNodeData>>) {
  const { icon, accentHex, displayName } = NODE_REGISTRY[data.type];
  const allHandles = [...data.cases, "default"];
  const handleCount = allHandles.length;

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
    >
      <div className="flex flex-col gap-2">
        {data.switchExpr && (
          <div className="font-mono text-xs text-zinc-300 bg-zinc-950/50 p-2 rounded border border-zinc-800 break-words">
            switch ({data.switchExpr})
          </div>
        )}

        <div className="flex flex-col gap-1">
          {data.cases.map((c, i) => (
            <div key={i} className="text-[10px] text-zinc-500 truncate">
              • {c}
            </div>
          ))}
          <div className="text-[10px] text-zinc-500 italic">• default</div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={HANDLE_CLASS}
        style={{ backgroundColor: accentHex }}
      />

      {allHandles.map((label, i) => {
        const topPercent = ((i + 1) / (handleCount + 1)) * 100;
        const handleId = i < data.cases.length ? `case-${i}` : "default";

        return (
          <div
            key={handleId}
            className="absolute flex items-center"
            style={{ top: `${topPercent}%`, right: -12, transform: "translateY(-50%)" }}
          >
            <span className="mr-1 text-[10px] text-zinc-400 whitespace-nowrap">
              {label}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={handleId}
              className={`!relative !right-0 !transform-none ${HANDLE_CLASS}`}
              style={{ backgroundColor: accentHex }}
            />
          </div>
        );
      })}
    </BaseNode>
  );
}

"use client";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { ifElseRegistryEntry } from "./constants";
import type { IfElseNodeData } from "./types";
export function IfElseNode({ data, selected }: NodeProps<Node<IfElseNodeData>>) {
  const { icon, accentHex, displayName } = ifElseRegistryEntry;
  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon}>
      <div className="font-mono text-xs text-zinc-300 bg-zinc-950/50 p-2 rounded border border-zinc-800 break-words">
        if ({data.expression || "condition"})
      </div>
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
      <div className="absolute -right-3 top-1/3 flex items-center transform -translate-y-1/2">
        <span className="mr-2 text-[10px] text-zinc-400 font-medium">True</span>
        <Handle type="source" position={Position.Right} id="true" className={`!right-0 !relative !transform-none ${HANDLE_CLASS}`} style={{ backgroundColor: accentHex }} />
      </div>
      <div className="absolute -right-3 top-2/3 flex items-center transform -translate-y-1/2">
        <span className="mr-2 text-[10px] text-zinc-400 font-medium">False</span>
        <Handle type="source" position={Position.Right} id="false" className={`!right-0 !relative !transform-none ${HANDLE_CLASS}`} style={{ backgroundColor: accentHex }} />
      </div>
    </BaseNode>
  );
}
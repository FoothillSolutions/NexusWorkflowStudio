"use client";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { askUserRegistryEntry } from "./constants";
import type { AskUserNodeData } from "./types";
const truncate = (str: string, n: number) => str?.length > n ? str.slice(0, n) + "..." : str;
export function AskUserNode({ data, selected }: NodeProps<Node<AskUserNodeData>>) {
  const { icon, accentHex, displayName } = askUserRegistryEntry;
  const handleCount = data.options.length;
  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon}>
      <div className="flex flex-col gap-2">
        <div className="text-zinc-400 text-xs break-words">{truncate(data.questionText || "No question defined", 60)}</div>
        <div className="flex flex-col gap-1 mt-1">
          {data.options.map((opt, i) => (
            <div key={i} className="text-[10px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded truncate">{opt}</div>
          ))}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
      {data.options.map((label, i) => {
        const topPercent = ((i + 1) / (handleCount + 1)) * 100;
        return (
          <div key={`option-${i}`} className="absolute flex items-center" style={{ top: `${topPercent}%`, right: -12, transform: "translateY(-50%)" }}>
            <span className="mr-1 text-[10px] text-zinc-400 whitespace-nowrap max-w-[60px] truncate">{label}</span>
            <Handle type="source" position={Position.Right} id={`option-${i}`} className={`!relative !right-0 !transform-none ${HANDLE_CLASS}`} style={{ backgroundColor: accentHex }} />
          </div>
        );
      })}
    </BaseNode>
  );
}
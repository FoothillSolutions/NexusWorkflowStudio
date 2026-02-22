"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { PromptNodeData } from "@/types/workflow";

export function PromptNode({ data, selected }: NodeProps<Node<PromptNodeData>>) {
  const { icon, accentHex, displayName } = NODE_REGISTRY[data.type];
  const truncate = (str: string, n: number) =>
    str?.length > n ? str.slice(0, n) + "..." : str;

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
    >
      <div className="flex flex-col gap-2">
        <div className="text-zinc-400 break-words whitespace-pre-wrap">
          {truncate(data.promptText || "", 60)}
        </div>
        
        {data.detectedVariables && data.detectedVariables.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.detectedVariables.map((variable) => (
              <span
                key={variable}
                className="text-[10px] bg-zinc-800 text-blue-300 px-1.5 py-0.5 rounded border border-blue-900/30"
              >
                {variable}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 border-2 border-zinc-800 rounded-full"
        style={{ backgroundColor: accentHex }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 border-2 border-zinc-800 rounded-full"
        style={{ backgroundColor: accentHex }}
      />
    </BaseNode>
  );
}

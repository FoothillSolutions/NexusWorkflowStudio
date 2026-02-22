"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { McpToolNodeData } from "@/types/workflow";
import { Box } from "lucide-react";

export function McpToolNode({ data, selected }: NodeProps<Node<McpToolNodeData>>) {
  const { icon, accentHex, displayName } = NODE_REGISTRY[data.type];

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 font-medium text-zinc-200">
          <Box size={14} className="text-zinc-500" />
          <span className="truncate">{data.toolName || "No tool selected"}</span>
        </div>
        
        {data.paramsText && (
          <div className="text-[10px] text-zinc-500 font-mono bg-zinc-950/50 p-2 rounded border border-zinc-800 overflow-hidden text-ellipsis whitespace-nowrap">
            {data.paramsText}
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

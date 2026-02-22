"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { SubAgentFlowNodeData } from "@/types/workflow";
import { Layers } from "lucide-react";

export function SubAgentFlowNode({ data, selected }: NodeProps<Node<SubAgentFlowNodeData>>) {
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
        <div className="text-sm font-medium text-zinc-300 truncate">
          {data.flowRef || "No flow selected"}
        </div>
        
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Layers size={12} />
          <span>{data.nodeCount} nodes</span>
        </div>
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

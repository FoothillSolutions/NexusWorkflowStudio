"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { SubAgentNodeData } from "@/types/workflow";
import { Bot } from "lucide-react";
import { HANDLE_CLASS } from "@/lib/theme";

export function SubAgentNode({ data, selected }: NodeProps<Node<SubAgentNodeData>>) {
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
        {data.agentName ? (
          <div className="flex items-center gap-1.5 bg-zinc-800/50 p-1.5 rounded border border-zinc-700/50">
            <Bot size={12} className="text-zinc-400" />
            <span className="text-xs font-medium text-zinc-200 truncate">
              {data.agentName}
            </span>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 italic">No agent selected</div>
        )}

        <div className="text-xs text-zinc-400 line-clamp-2">
          {data.taskText || "No task defined"}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={HANDLE_CLASS}
        style={{ backgroundColor: accentHex }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={HANDLE_CLASS}
        style={{ backgroundColor: accentHex }}
      />
    </BaseNode>
  );
}

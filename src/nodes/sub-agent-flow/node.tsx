"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { Layers } from "lucide-react";
import { subAgentFlowRegistryEntry } from "./constants";
import type { SubAgentFlowNodeData } from "./types";
export const SubAgentFlowNode = memo(function SubAgentFlowNode({ data, selected }: NodeProps<Node<SubAgentFlowNodeData>>) {
  const { icon, accentHex, displayName } = subAgentFlowRegistryEntry;
  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon}>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-zinc-300 truncate">{data.flowRef || "No flow selected"}</div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Layers size={12} /><span>{data.nodeCount} nodes</span>
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
      <Handle type="source" position={Position.Right} id="output" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
    </BaseNode>
  );
});

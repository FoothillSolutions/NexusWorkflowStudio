"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { endRegistryEntry } from "./constants";
import type { EndNodeData } from "./types";
export const EndNode = memo(function EndNode({ id, data, selected }: NodeProps<Node<EndNodeData>>) {
  const { icon, accentHex, displayName } = endRegistryEntry;
  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon} nodeId={id}>
      <div className="text-zinc-500 italic">Terminal</div>
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
    </BaseNode>
  );
});

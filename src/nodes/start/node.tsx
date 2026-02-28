"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { startRegistryEntry } from "./constants";
import type { StartNodeData } from "./types";
export const StartNode = memo(function StartNode({ data, selected }: NodeProps<Node<StartNodeData>>) {
  const { icon, accentHex, displayName } = startRegistryEntry;
  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon}>
      <div className="text-zinc-500 italic">Workflow entry point</div>
      <Handle type="source" position={Position.Right} id="output" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
    </BaseNode>
  );
});

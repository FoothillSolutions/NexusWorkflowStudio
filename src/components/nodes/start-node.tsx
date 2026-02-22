"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { StartNodeData } from "@/types/workflow";
import { HANDLE_CLASS } from "@/lib/theme";

export function StartNode({ data, selected }: NodeProps<Node<StartNodeData>>) {
  const { icon, accentHex, displayName } = NODE_REGISTRY[data.type];

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
    >
      <div className="text-zinc-500 italic">Workflow entry point</div>

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

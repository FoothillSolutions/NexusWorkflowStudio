"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { EndNodeData } from "@/types/workflow";
import { HANDLE_CLASS } from "@/lib/theme";

export function EndNode({ data, selected }: NodeProps<Node<EndNodeData>>) {
  const { icon, accentHex, displayName } = NODE_REGISTRY[data.type];

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
    >
      <div className="text-zinc-500 italic">Terminal</div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={HANDLE_CLASS}
        style={{ backgroundColor: accentHex }}
      />
    </BaseNode>
  );
}

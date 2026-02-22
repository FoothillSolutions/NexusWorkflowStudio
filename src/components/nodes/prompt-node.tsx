"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode, NodeSize } from "./base-node";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { PromptNodeData } from "@/types/workflow";
import { HANDLE_CLASS } from "@/lib/theme";

export function PromptNode({ data, selected }: NodeProps<Node<PromptNodeData>>) {
  const { icon, accentHex, displayName } = NODE_REGISTRY[data.type];
  const truncate = (str: string, n: number) =>
    str?.length > n ? str.slice(0, n) + "…" : str;

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
      size={NodeSize.Large}
    >
      <div className="flex flex-col gap-2">
        {data.promptText && (() => {
          const lines = data.promptText.split("\n");
          const shown = lines.slice(0, 4);
          const hasMore = lines.length > 4 || shown.some((l) => l.length > 45);
          return (
            <div className="text-xs text-zinc-500 font-mono whitespace-pre-wrap break-words">
              {shown.map((line) => truncate(line, 45)).join("\n")}
              {hasMore && <span className="text-zinc-600"> …</span>}
            </div>
          );
        })()}

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

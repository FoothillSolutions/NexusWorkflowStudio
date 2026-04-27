"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { FileText, MessageSquareText } from "lucide-react";
import { BaseNode } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import type { HandoffNodeData } from "@/types/workflow";
import { handoffRegistryEntry } from "./constants";
import { resolveHandoffFilePath } from "./generator";

const truncate = (str: string, n: number) => ((str?.length ?? 0) > n ? `...${str.slice(-n)}` : str);

export const HandoffNode = memo(function HandoffNode({ id, data, selected }: NodeProps<Node<HandoffNodeData>>) {
  const { icon, accentHex, displayName } = handoffRegistryEntry;
  const mode = data.mode ?? "file";
  const payloadStyle = data.payloadStyle ?? "structured";
  const sectionCount = data.payloadSections?.length ?? 0;
  const resolvedPath = mode === "file" ? resolveHandoffFilePath(id, data) : "";

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
      nodeId={id}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-cyan-950/50 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.5 rounded-md">
            {mode === "file" ? <FileText className="h-2.5 w-2.5" /> : <MessageSquareText className="h-2.5 w-2.5" />}
            {mode}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-900/60 text-zinc-300 border border-zinc-700/40 px-1.5 py-0.5 rounded-md">
            {payloadStyle === "structured"
              ? `${sectionCount} section${sectionCount === 1 ? "" : "s"}`
              : "freeform"}
          </span>
        </div>
        {mode === "file" && (
          <div className="text-[10px] text-zinc-500 font-mono bg-zinc-950/50 p-2 rounded border border-zinc-800 overflow-hidden text-ellipsis whitespace-nowrap">
            {truncate(resolvedPath, 36)}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
      <Handle type="source" position={Position.Right} id="output" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
    </BaseNode>
  );
});

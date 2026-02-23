"use client";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { FolderGit2 } from "lucide-react";
import { skillRegistryEntry } from "./constants";
import type { SkillNodeData } from "./types";
export function SkillNode({ data, selected }: NodeProps<Node<SkillNodeData>>) {
  const { icon, accentHex, displayName } = skillRegistryEntry;
  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon}>
      <div className="flex flex-col gap-2">
        <div className="font-medium text-zinc-200 truncate">{data.skillName || "No skill selected"}</div>
        {data.projectName && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded w-fit max-w-full">
            <FolderGit2 size={12} className="shrink-0" /><span className="truncate">{data.projectName}</span>
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
      <Handle type="source" position={Position.Right} id="output" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
    </BaseNode>
  );
}
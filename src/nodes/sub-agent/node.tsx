"use client";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode, NodeSize } from "@/nodes/shared/base-node";
import { detectVarCounts } from "@/nodes/shared/variable-utils";
import { HANDLE_CLASS } from "@/lib/theme";
import { DollarSign, Braces, Cpu, Database, Wrench } from "lucide-react";
import { subAgentRegistryEntry } from "./constants";
import { SubAgentModel, SubAgentMemory } from "./types";
import type { SubAgentNodeData } from "./types";
const truncate = (str: string, n: number) => str?.length > n ? str.slice(0, n) + "..." : str;
export function SubAgentNode({ data, selected }: NodeProps<Node<SubAgentNodeData>>) {
  const { icon, accentHex, displayName } = subAgentRegistryEntry;
  const varCounts = data.promptText ? detectVarCounts(data.promptText) : { dynamic: 0, static: 0 };
  const totalVars = varCounts.dynamic + varCounts.static;
  const hasModel  = data.model  && data.model  !== SubAgentModel.Inherit;
  const hasMemory = data.memory && data.memory !== SubAgentMemory.Default;
  const hasTools  = !!data.tools?.trim();
  const hasMeta   = hasModel || hasMemory || hasTools;
  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon} size={NodeSize.Large}>
      <div className="flex flex-col gap-2">
        {data.promptText && (() => {
          const lines = data.promptText.split("\n");
          const shown = lines.slice(0, 4);
          const hasMore = lines.length > 4 || shown.some((l) => l.length > 45);
          return (
            <div className="text-xs text-zinc-500 font-mono whitespace-pre-wrap break-words">
              {shown.map((line) => truncate(line, 45)).join("\n")}
              {hasMore && <span className="text-zinc-600"> ...</span>}
            </div>
          );
        })()}
        {totalVars > 0 && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {varCounts.dynamic > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/40 px-1.5 py-0.5 rounded-md">
                <DollarSign className="h-2.5 w-2.5" />{varCounts.dynamic}
              </span>
            )}
            {varCounts.static > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/40 px-1.5 py-0.5 rounded-md">
                <Braces className="h-2.5 w-2.5" />{varCounts.static}
              </span>
            )}
          </div>
        )}
        {hasMeta && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {hasModel && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-violet-950/60 text-violet-300 border border-violet-800/40 px-1.5 py-0.5 rounded-md">
                <Cpu className="h-2.5 w-2.5" />{data.model}
              </span>
            )}
            {hasMemory && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.5 rounded-md">
                <Database className="h-2.5 w-2.5" />{data.memory}
              </span>
            )}
            {hasTools && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-orange-950/60 text-orange-300 border border-orange-800/40 px-1.5 py-0.5 rounded-md">
                <Wrench className="h-2.5 w-2.5" />{truncate(data.tools, 20)}
              </span>
            )}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
      <Handle type="source" position={Position.Right} id="output" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
    </BaseNode>
  );
}
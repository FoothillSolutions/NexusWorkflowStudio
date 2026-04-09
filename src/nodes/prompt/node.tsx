"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode, NodeSize } from "@/nodes/shared/base-node";
import { detectVarCounts } from "@/nodes/shared/variable-utils";
import { HANDLE_CLASS } from "@/lib/theme";
import { Brain, Braces, DollarSign } from "lucide-react";
import { promptRegistryEntry } from "./constants";
import type { PromptNodeData } from "./types";
import { useKnowledgeStore } from "@/store/knowledge-store";
const truncate = (str: string, n: number) => str?.length > n ? str.slice(0, n) + "..." : str;
export const PromptNode = memo(function PromptNode({ id, data, selected }: NodeProps<Node<PromptNodeData>>) {
  const { icon, accentHex, displayName } = promptRegistryEntry;
  const varCounts = data.promptText ? detectVarCounts(data.promptText) : { dynamic: 0, static: 0 };
  const totalVars = varCounts.dynamic + varCounts.static;
  const brainDoc = useKnowledgeStore(
    (s) => data.brainDocId ? s.docs.find((d) => d.id === data.brainDocId) ?? null : null,
  );
  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon} size={NodeSize.Large} nodeId={id}>
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
        {brainDoc && (
          <div className="flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/8 px-2 py-1">
            <Brain size={10} className="shrink-0 text-sky-400" />
            <span className="truncate text-[10px] text-sky-300">{brainDoc.title}</span>
          </div>
        )}
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
      </div>
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
      <Handle type="source" position={Position.Right} id="output" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
    </BaseNode>
  );
});

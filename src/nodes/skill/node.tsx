"use client";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode, NodeSize } from "@/nodes/shared/base-node";
import { detectVarCounts } from "@/nodes/shared/variable-utils";
import { HANDLE_CLASS } from "@/lib/theme";
import { DollarSign, Braces, Zap } from "lucide-react";
import { skillRegistryEntry } from "./constants";
import type { SkillNodeData } from "./types";
import { useWorkflowStore } from "@/store/workflow-store";

const truncate = (str: string, n: number) => (str?.length ?? 0) > n ? str.slice(0, n) + "..." : str;

export function SkillNode({ data, selected }: NodeProps<Node<SkillNodeData>>) {
  const { icon, accentHex, displayName } = skillRegistryEntry;
  const nodes = useWorkflowStore((s) => s.nodes);

  const varCounts = data.promptText ? detectVarCounts(data.promptText) : { dynamic: 0, static: 0 };
  const totalVars = varCounts.dynamic + varCounts.static;

  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon} size={NodeSize.Small}>
      <div className="flex flex-col gap-2">
        {/* Prompt preview */}
        {data.promptText && (() => {
          const lines = data.promptText.split("\n");
          const shown = lines.slice(0, 3);
          const hasMore = lines.length > 3 || shown.some((l) => l.length > 45);
          return (
            <div className="text-xs text-zinc-500 font-mono whitespace-pre-wrap break-words">
              {shown.map((line) => truncate(line, 45)).join("\n")}
              {hasMore && <span className="text-zinc-600"> ...</span>}
            </div>
          );
        })()}

        {/* Variable badges */}
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

        {/* Metadata count badge */}
        {Array.isArray(data.metadata) && data.metadata.filter((m) => m.key?.trim()).length > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 px-1.5 py-0.5 rounded-md">
              {data.metadata.filter((m) => m.key?.trim()).length} meta
            </span>
          </div>
        )}
      </div>

      {/* Skill-out footer */}
      <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-cyan-900/40">
        <span className="text-[9px] font-mono text-cyan-700 tracking-wide uppercase">skill out</span>
        <Zap size={9} className="text-cyan-600 shrink-0" />
      </div>

      {/* Single source-only handle — only valid target is an agent node */}
      <Handle
        type="source"
        position={Position.Right}
        id="skill-out"
        className={HANDLE_CLASS}
        style={{ backgroundColor: "#06b6d4", top: "auto", bottom: 14 }}
        isValidConnection={(connection) => {
          const targetNode = nodes.find((n) => n.id === connection.target);
          return targetNode?.data?.type === "agent";
        }}
      />
    </BaseNode>
  );
}
"use client";
import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode, NodeSize } from "@/nodes/shared/base-node";
import { detectVarCounts } from "@/nodes/shared/variable-utils";
import { HANDLE_CLASS } from "@/lib/theme";
import { NODE_ACCENT } from "@/lib/node-colors";
import { Braces, DollarSign, FileCode2, Link2, Sparkles, Zap } from "lucide-react";
import { skillRegistryEntry } from "./constants";
import type { SkillNodeData } from "./types";
import { useWorkflowStore } from "@/store/workflow";

const truncate = (str: string, n: number) => (str?.length ?? 0) > n ? str.slice(0, n) + "..." : str;

export const SkillNode = memo(function SkillNode({ id, data, selected }: NodeProps<Node<SkillNodeData>>) {
  const { icon, accentHex, displayName } = skillRegistryEntry;
  const scriptCount = useWorkflowStore(
    useCallback(
      (s) => s.edges.filter((e) => e.target === id && e.targetHandle === "scripts").length
        + s.subWorkflowEdges.filter((e) => e.target === id && e.targetHandle === "scripts").length,
      [id],
    ),
  );

  const mappedScriptCount = Object.values(data.variableMappings ?? {}).filter((value) => value?.startsWith("script:")).length;

  // Read nodes at call-time via getState() to avoid subscribing
  // the component to every node position change during drag.
  const isValidAgentConnection = useCallback(
    (connection: { target: string }) => {
      const state = useWorkflowStore.getState();
      const targetNode = state.nodes.find((n) => n.id === connection.target)
        ?? state.subWorkflowNodes.find((n) => n.id === connection.target);
      return targetNode?.data?.type === "agent" || targetNode?.data?.type === "parallel-agent";
    },
    []
  );

  const isValidScriptConnection = useCallback(
    (connection: { source: string }) => {
      const state = useWorkflowStore.getState();
      const sourceNode = state.nodes.find((n) => n.id === connection.source)
        ?? state.subWorkflowNodes.find((n) => n.id === connection.source);
      return sourceNode?.data?.type === "script";
    },
    [],
  );

  const varCounts = data.promptText ? detectVarCounts(data.promptText) : { dynamic: 0, static: 0 };
  const totalVars = varCounts.dynamic + varCounts.static;

  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon} size={NodeSize.Medium} nodeId={id}>
      <div className="flex flex-col gap-2.5">
        {!!data.description?.trim() && (
          <p className="text-xs leading-relaxed text-zinc-400 line-clamp-2">{data.description}</p>
        )}

        {data.promptText && (() => {
          const lines = data.promptText.split("\n");
          const shown = lines.slice(0, 3);
          const hasMore = lines.length > 3 || shown.some((l) => l.length > 45);
          return (
            <div className="rounded-xl border border-cyan-900/30 bg-cyan-950/10 px-2.5 py-2 text-xs text-zinc-400 font-mono whitespace-pre-wrap wrap-break-word">
              {shown.map((line) => truncate(line, 45)).join("\n")}
              {hasMore && <span className="text-zinc-600"> ...</span>}
            </div>
          );
        })()}

        {(totalVars > 0 || scriptCount > 0 || mappedScriptCount > 0 || (Array.isArray(data.metadata) && data.metadata.some((m) => m.key?.trim()))) && (
          <div className="flex flex-wrap gap-1.5">
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
            {scriptCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-sky-950/60 text-sky-300 border border-sky-800/40 px-1.5 py-0.5 rounded-md">
                <FileCode2 className="h-2.5 w-2.5" />{scriptCount}
              </span>
            )}
            {mappedScriptCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-violet-950/60 text-violet-300 border border-violet-800/40 px-1.5 py-0.5 rounded-md">
                <Link2 className="h-2.5 w-2.5" />{mappedScriptCount}
              </span>
            )}
            {Array.isArray(data.metadata) && data.metadata.filter((m) => m.key?.trim()).length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 px-1.5 py-0.5 rounded-md">
                <Sparkles className="h-2.5 w-2.5" />{data.metadata.filter((m) => m.key?.trim()).length} meta
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-cyan-900/30">
        <div className="flex items-center gap-1.5">
          <FileCode2 size={9} className="text-sky-500 shrink-0" />
          <span className="text-[9px] font-mono text-sky-700 tracking-wide uppercase">scripts in</span>
        </div>
        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-[9px] font-mono text-cyan-700 tracking-wide uppercase">skill out</span>
          <Zap size={9} className="text-cyan-600 shrink-0" />
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="scripts"
        className={HANDLE_CLASS}
        style={{ backgroundColor: "#38bdf8", top: "auto", bottom: 34 }}
        isValidConnection={isValidScriptConnection}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="skill-out"
        className={HANDLE_CLASS}
        style={{ backgroundColor: NODE_ACCENT.skill, top: "auto", bottom: 12 }}
        isValidConnection={isValidAgentConnection}
      />
    </BaseNode>
  );
});

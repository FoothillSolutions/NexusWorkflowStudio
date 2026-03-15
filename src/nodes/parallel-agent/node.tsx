"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { FileText, Network, Users, Zap } from "lucide-react";
import { BaseNode, NodeSize } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { NODE_ACCENT } from "@/lib/node-colors";
import { useWorkflowStore } from "@/store/workflow-store";
import type { ParallelAgentNodeData } from "@/types/workflow";
import { parallelAgentRegistryEntry } from "./constants";

const truncate = (str: string, n: number) => ((str?.length ?? 0) > n ? `${str.slice(0, n)}...` : str);

type ParallelAgentBranchView = {
  label?: string;
  instructions?: string;
  spawnCount?: number;
};

export const ParallelAgentNode = memo(function ParallelAgentNode({ id, data, selected }: NodeProps<Node<ParallelAgentNodeData>>) {
  const { icon, accentHex, displayName } = parallelAgentRegistryEntry;
  const branches: ParallelAgentBranchView[] = (data.branches as ParallelAgentBranchView[] | undefined) ?? [];
  const totalSpawnCount = branches.reduce((sum, branch) => sum + Math.max(1, Number(branch.spawnCount ?? 1)), 0);
  const agentLabel = branches.length === 1 ? "agent" : "agents";

  const skillCount = useWorkflowStore(
    useCallback(
      (s) => s.edges.filter((e) => e.target === id && e.targetHandle === "skills").length,
      [id],
    ),
  );

  const docCount = useWorkflowStore(
    useCallback(
      (s) => s.edges.filter((e) => e.target === id && e.targetHandle === "docs").length,
      [id],
    ),
  );

  const isValidSkillConnection = useCallback((connection: { source: string }) => {
    const sourceNode = useWorkflowStore.getState().nodes.find((n) => n.id === connection.source);
    return sourceNode?.data?.type === "skill";
  }, []);

  const isValidDocConnection = useCallback((connection: { source: string }) => {
    const sourceNode = useWorkflowStore.getState().nodes.find((n) => n.id === connection.source);
    return sourceNode?.data?.type === "document";
  }, []);

  const isValidBranchConnection = useCallback((connection: { target: string }) => {
    const state = useWorkflowStore.getState();
    const targetNode = state.nodes.find((n) => n.id === connection.target)
      ?? state.subWorkflowNodes.find((n) => n.id === connection.target);
    return targetNode?.data?.type === "agent";
  }, []);

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
      size={NodeSize.Large}
      nodeId={id}
    >
      <div className="flex flex-col gap-2.5">
        {data.sharedInstructions?.trim() && (
          <div className="rounded-lg border border-indigo-800/30 bg-indigo-950/20 px-2.5 py-2 text-[11px] leading-snug text-indigo-200/85">
            {truncate(data.sharedInstructions.trim(), 140)}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-indigo-950/50 text-indigo-300 border border-indigo-800/40 px-1.5 py-0.5 rounded-md">
            <Users className="h-2.5 w-2.5" />{branches.length} {agentLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-violet-950/50 text-violet-300 border border-violet-800/40 px-1.5 py-0.5 rounded-md">
            <Network className="h-2.5 w-2.5" />x{totalSpawnCount} total
          </span>
          {skillCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.5 rounded-md">
              <Zap className="h-2.5 w-2.5" />{skillCount} skills
            </span>
          )}
          {docCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-yellow-950/60 text-yellow-300 border border-yellow-800/40 px-1.5 py-0.5 rounded-md">
              <FileText className="h-2.5 w-2.5" />{docCount} docs
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {branches.map((branch, index) => (
            <div key={`${branch.label}-${index}`} className="relative flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-md border border-zinc-700/50 bg-zinc-950/40 px-2.5 py-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-200 truncate">
                  <Network className="h-3 w-3 text-indigo-300 shrink-0" />
                  <span className="truncate">{branch.label || `Branch ${index + 1}`}</span>
                </div>
                <div className="mt-0.5 text-[10px] font-mono text-indigo-300/80 truncate">spawn x{Math.max(1, Number(branch.spawnCount ?? 1))}</div>
                {branch.instructions?.trim() && (
                  <p className="mt-1 text-[10px] leading-tight text-zinc-500 truncate">
                    {truncate(branch.instructions.trim(), 70)}
                  </p>
                )}
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id={`branch-${index}`}
                className="relative! right-0! top-0! transform-none! h-2.5! w-2.5! border! border-zinc-700! rounded-full! shadow-sm!"
                style={{ backgroundColor: accentHex }}
                isValidConnection={isValidBranchConnection}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-zinc-700/30">
        <div className="flex items-center gap-1.5">
          <Network size={9} className="text-indigo-500 shrink-0" />
          <span className="text-[9px] font-mono text-indigo-400 tracking-wide uppercase">connect outputs to agent nodes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap size={9} className="text-cyan-600 shrink-0" />
          <span className="text-[9px] font-mono text-cyan-700 tracking-wide uppercase">shared skills</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText size={9} className="text-yellow-600 shrink-0" />
          <span className="text-[9px] font-mono text-yellow-700 tracking-wide uppercase">shared docs</span>
        </div>
      </div>

      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />

      <Handle
        type="target"
        position={Position.Left}
        id="skills"
        className={HANDLE_CLASS}
        style={{ backgroundColor: NODE_ACCENT.skill, top: "auto", bottom: 30 }}
        isValidConnection={isValidSkillConnection}
      />

      <Handle
        type="target"
        position={Position.Left}
        id="docs"
        className={HANDLE_CLASS}
        style={{ backgroundColor: NODE_ACCENT.document, top: "auto", bottom: 10 }}
        isValidConnection={isValidDocConnection}
      />
    </BaseNode>
  );
});


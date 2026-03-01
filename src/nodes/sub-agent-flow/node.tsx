"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode, NodeSize } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { Layers, Cpu, Thermometer, Wrench, Bot, Workflow } from "lucide-react";
import { SubAgentModel, MODEL_DISPLAY_NAMES } from "@/nodes/sub-agent/enums";
import { subAgentFlowRegistryEntry } from "./constants";
import type { SubAgentFlowNodeData } from "./types";

const truncate = (str: string, n: number) => str?.length > n ? str.slice(0, n) + "..." : str;

export const SubAgentFlowNode = memo(function SubAgentFlowNode({ data, selected }: NodeProps<Node<SubAgentFlowNodeData>>) {
  const { icon, accentHex: defaultAccent, displayName } = subAgentFlowRegistryEntry;
  const accentHex = (data.mode === "agent" && data.color?.trim()) ? data.color : defaultAccent;
  const isAgentMode = data.mode === "agent";
  const temperature = Number(data.temperature ?? 0);

  const hasModel    = isAgentMode && data.model && data.model !== SubAgentModel.Inherit;
  const hasTemp     = isAgentMode && temperature > 0;
  const hasDisabled = isAgentMode && Array.isArray(data.disabledTools) && data.disabledTools.length > 0;

  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon} size={NodeSize.Large}>
      <div className="flex flex-col gap-2.5">
        {/* Mode badge */}
        <div className="flex items-center gap-2">
          {isAgentMode ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-violet-950/60 text-violet-300 border border-violet-800/40 px-2 py-0.5 rounded-md">
              <Bot className="h-2.5 w-2.5" />Agent Mode
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded-md">
              <Workflow className="h-2.5 w-2.5" />Same Context
            </span>
          )}
        </div>

        {/* Node count — prominent */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
          <Layers size={14} className="text-purple-400 shrink-0" />
          <span className="text-sm font-semibold text-zinc-200">{data.nodeCount}</span>
          <span className="text-xs text-zinc-500">nodes inside</span>
        </div>

        {/* Agent-mode meta badges */}
        {isAgentMode && (hasModel || hasTemp || hasDisabled) && (
          <div className="flex flex-wrap gap-1">
            {hasModel && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-violet-950/60 text-violet-300 border border-violet-800/40 px-1.5 py-0.5 rounded-md">
                <Cpu className="h-2.5 w-2.5" />
                {truncate(MODEL_DISPLAY_NAMES[data.model as SubAgentModel] ?? String(data.model), 18)}
              </span>
            )}
            {hasTemp && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-orange-950/60 text-orange-300 border border-orange-800/40 px-1.5 py-0.5 rounded-md">
                <Thermometer className="h-2.5 w-2.5" />{temperature.toFixed(1)}
              </span>
            )}
            {hasDisabled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-red-950/60 text-red-300 border border-red-800/40 px-1.5 py-0.5 rounded-md">
                <Wrench className="h-2.5 w-2.5" />{data.disabledTools.length} off
              </span>
            )}
          </div>
        )}
      </div>

      {/* Standard flow handles */}
      <Handle type="target" position={Position.Left} id="input" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
      <Handle type="source" position={Position.Right} id="output" className={HANDLE_CLASS} style={{ backgroundColor: accentHex }} />
    </BaseNode>
  );
});

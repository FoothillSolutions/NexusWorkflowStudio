"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode, NodeSize } from "@/nodes/shared/base-node";
import { detectVarCounts } from "@/nodes/shared/variable-utils";
import { HANDLE_CLASS } from "@/lib/theme";
import { NODE_ACCENT } from "@/lib/node-colors";
import { Braces, DollarSign, TerminalSquare } from "lucide-react";
import { scriptRegistryEntry } from "./constants";
import type { ScriptNodeData } from "./types";
import { useWorkflowStore } from "@/store/workflow";

const truncate = (str: string, n: number) => str?.length > n ? str.slice(0, n) + "..." : str;

export const ScriptNode = memo(function ScriptNode({ id, data, selected }: NodeProps<Node<ScriptNodeData>>) {
  const { icon, accentHex, displayName } = scriptRegistryEntry;

  const isValidSkillConnection = useCallback(
    (connection: { target: string }) => {
      const state = useWorkflowStore.getState();
      const targetNode = state.nodes.find((n) => n.id === connection.target)
        ?? state.subWorkflowNodes.find((n) => n.id === connection.target);
      return targetNode?.data?.type === "skill";
    },
    [],
  );

  const varCounts = data.promptText ? detectVarCounts(data.promptText) : { dynamic: 0, static: 0 };
  const totalVars = varCounts.dynamic + varCounts.static;

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
      <div className="flex flex-col gap-2">
        {data.promptText && (() => {
          const lines = data.promptText.split("\n");
          const shown = lines.slice(0, 4);
          const hasMore = lines.length > 4 || shown.some((line) => line.length > 48);
          return (
            <div className="rounded-xl border border-sky-900/30 bg-sky-950/10 px-2.5 py-2 text-xs text-zinc-400 font-mono whitespace-pre-wrap wrap-break-word">
              {shown.map((line) => truncate(line, 48)).join("\n")}
              {hasMore && <span className="text-zinc-600"> ...</span>}
            </div>
          );
        })()}

        {totalVars > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
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

      <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-sky-900/30">
        <span className="text-[9px] font-mono text-sky-700 tracking-wide uppercase">script out</span>
        <TerminalSquare size={9} className="text-sky-500 shrink-0" />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="script-out"
        className={HANDLE_CLASS}
        style={{ backgroundColor: NODE_ACCENT.script, top: "auto", bottom: 12 }}
        isValidConnection={isValidSkillConnection}
      />
    </BaseNode>
  );
});


"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { switchRegistryEntry } from "./constants";
import type { SwitchNodeData, SwitchBranch } from "./types";

export const SwitchNode = memo(function SwitchNode({ id, data, selected }: NodeProps<Node<SwitchNodeData>>) {
  const { icon, accentHex, displayName } = switchRegistryEntry;
  const branches: SwitchBranch[] = data.branches ?? [
    { label: "Case 1", condition: "" },
    { label: "Case 2", condition: "" },
    { label: "default", condition: "Other cases" },
  ];

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
      nodeId={id}
    >
      {/* Evaluation target */}
      {data.evaluationTarget && (
        <div className="text-[11px] text-zinc-400 mb-2 leading-snug truncate">
          {data.evaluationTarget}
        </div>
      )}

      {/* Branch blocks */}
      <div className="flex flex-col gap-1.5">
        {branches.map((branch, i) => {
          const isDefault = branch.label === "default";
          const handleId = branch.label || (isDefault ? "default" : `case-${i}`);
          return (
            <div key={i} className="relative flex items-center gap-2">
              {/* Branch pill with left accent stripe */}
              <div
                className="flex-1 min-w-0 flex flex-col gap-0.5 pl-2.5 pr-2 py-1.5 rounded-md bg-zinc-950/40 overflow-hidden relative"
                style={{
                  borderLeft: isDefault
                    ? "2px dashed #52525b"
                    : `2px solid ${accentHex}`,
                  borderTop: "1px solid rgba(63,63,70,0.4)",
                  borderRight: "1px solid rgba(63,63,70,0.4)",
                  borderBottom: "1px solid rgba(63,63,70,0.4)",
                }}
              >
                <span
                  className={`text-[11px] font-medium truncate ${
                    isDefault ? "text-zinc-500 italic" : "text-zinc-300"
                  }`}
                >
                  {branch.label || `Case ${i + 1}`}
                </span>
                {branch.condition && (
                  <p className="text-[10px] text-zinc-500 leading-tight truncate">
                    {branch.condition}
                  </p>
                )}
              </div>
              {/* Source handle */}
              <Handle
                type="source"
                position={Position.Right}
                id={handleId}
                className="!relative !right-0 !top-0 !transform-none !h-2.5 !w-2.5 !border !border-zinc-700 !rounded-full !shadow-sm"
                style={{
                  backgroundColor: isDefault ? "#52525b" : accentHex,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!h-2.5 !w-2.5 !border !border-zinc-700 !rounded-full !shadow-sm"
        style={{ backgroundColor: accentHex }}
      />
    </BaseNode>
  );
});

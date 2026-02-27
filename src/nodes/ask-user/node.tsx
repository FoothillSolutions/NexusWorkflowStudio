"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { Sparkles, ListChecks } from "lucide-react";
import { askUserRegistryEntry } from "./constants";
import type { AskUserNodeData } from "./types";

const truncate = (str: string, n: number) =>
  str?.length > n ? str.slice(0, n) + "..." : str;

export function AskUserNode({
  data,
  selected,
}: NodeProps<Node<AskUserNodeData>>) {
  const { icon, accentHex, displayName } = askUserRegistryEntry;
  const aiSuggested = data.aiSuggestOptions ?? false;
  const multiSelect = data.multipleSelection ?? false;
  const options = data.options ?? [];

  // Single handle when AI suggested or multi-select is on
  const singleHandle = aiSuggested || multiSelect;

  return (
    <BaseNode
      accentHex={accentHex}
      selected={selected}
      label={data.label || displayName}
      type={data.type}
      icon={icon}
    >
      <div className="flex flex-col gap-2">
        {/* Question text */}
        <div className="text-zinc-400 text-xs break-words">
          {truncate(data.questionText || "No question defined", 60)}
        </div>

        {/* Badges row */}
        {(aiSuggested || multiSelect) && (
          <div className="flex flex-wrap gap-1.5">
            {aiSuggested && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
                <Sparkles className="h-2.5 w-2.5 text-violet-400" />
                <span className="text-[10px] font-medium text-violet-300">
                  AI Options
                </span>
              </div>
            )}
            {multiSelect && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/20">
                <ListChecks className="h-2.5 w-2.5 text-pink-400" />
                <span className="text-[10px] font-medium text-pink-300">
                  Multi-select
                </span>
              </div>
            )}
          </div>
        )}

        {/* Options display area */}
        {aiSuggested ? (
          /* AI-suggested: show placeholder */
          <div className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-dashed border-violet-500/20 bg-violet-500/5">
            <Sparkles className="h-4 w-4 text-violet-400/60" />
            <span className="text-[10px] text-violet-300/60 font-medium">
              AI generates options dynamically
            </span>
          </div>
        ) : (
          /* Manual options — handles inline with each row */
          <div className="flex flex-col gap-1.5">
            {options.map((opt, i) => (
              <div key={i} className="relative flex items-center gap-2">
                {/* Option pill */}
                <div
                  className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md bg-zinc-950/40 overflow-hidden"
                  style={{
                    borderLeft: `2px solid ${accentHex}`,
                    borderTop: "1px solid rgba(63,63,70,0.4)",
                    borderRight: "1px solid rgba(63,63,70,0.4)",
                    borderBottom: "1px solid rgba(63,63,70,0.4)",
                  }}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[11px] text-zinc-300 font-medium truncate">
                      {opt.label || `Option ${i + 1}`}
                    </span>
                    {opt.description && (
                      <span className="text-[10px] text-zinc-500 truncate leading-tight">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>
                {/* Inline source handle — only when not single-handle mode */}
                {!singleHandle && (
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`option-${i}`}
                    className="!relative !right-0 !top-0 !transform-none !h-2.5 !w-2.5 !border !border-zinc-700 !rounded-full !shadow-sm"
                    style={{ backgroundColor: accentHex }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={HANDLE_CLASS}
        style={{ backgroundColor: accentHex }}
      />

      {/* Single output handle for AI-suggested or multi-select */}
      {singleHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className={HANDLE_CLASS}
          style={{ backgroundColor: accentHex }}
        />
      )}
    </BaseNode>
  );
}
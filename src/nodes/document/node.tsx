"use client";
import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode, NodeSize } from "@/nodes/shared/base-node";
import { HANDLE_CLASS } from "@/lib/theme";
import { NODE_ACCENT } from "@/lib/node-colors";
import { FileText, FileUp, Zap } from "lucide-react";
import { WorkflowNodeType } from "@/types/workflow";
import { documentRegistryEntry } from "./constants";
import type { DocumentNodeData } from "./types";
import { useWorkflowStore } from "@/store/workflow";
import { getDocumentDisplayPath } from "./utils";

/** Maximum number of characters shown for a linked file badge. */
const LINKED_FILE_LABEL_MAX_LENGTH = 30;

/** Number of inline content preview lines to render inside the node card. */
const INLINE_CONTENT_PREVIEW_LINE_COUNT = 3;

/** Maximum characters kept from each inline preview line before truncation. */
const INLINE_CONTENT_PREVIEW_LINE_LENGTH = 45;

const truncate = (str: string | null | undefined, maxLength: number) =>
  (str?.length ?? 0) > maxLength ? `${str?.slice(0, maxLength)}...` : (str ?? "");

const EXT_LABELS: Record<string, string> = { md: "Markdown", txt: "Text", json: "JSON", yaml: "YAML" };

export const DocumentNode = memo(function DocumentNode({ id, data, selected }: NodeProps<Node<DocumentNodeData>>) {
  const { icon, accentHex, displayName } = documentRegistryEntry;

  const isValidAgentConnection = useCallback(
    (connection: { target: string }) => {
      const state = useWorkflowStore.getState();
      const targetNode = state.nodes.find((n) => n.id === connection.target)
        ?? state.subWorkflowNodes.find((n) => n.id === connection.target);
      return targetNode?.data?.type === WorkflowNodeType.Agent
        || targetNode?.data?.type === WorkflowNodeType.ParallelAgent;
    },
    []
  );

  const isLinked = data.contentMode === "linked";
  const ext = data.fileExtension || "md";
  const documentPath = getDocumentDisplayPath(data);

  return (
    <BaseNode accentHex={accentHex} selected={selected} label={data.label || displayName} type={data.type} icon={icon} size={NodeSize.Small} nodeId={id}>
      <div className="flex flex-col gap-2">
        {/* Doc name */}
        {data.docName && (
          <div className="flex items-center gap-1.5">
            <FileText size={10} className="text-yellow-500 shrink-0" />
            <span className="text-xs font-mono text-yellow-300 truncate" title={`docs/${documentPath}`}>{documentPath}</span>
          </div>
        )}

        {/* Content preview or linked file badge */}
        {isLinked ? (
          data.linkedFileName && (
            <div className="flex items-center gap-1.5">
              <FileUp size={10} className="text-yellow-600 shrink-0" />
              <span className="text-[10px] text-zinc-500 font-mono truncate">
                {truncate(data.linkedFileName, LINKED_FILE_LABEL_MAX_LENGTH)}
              </span>
            </div>
          )
        ) : (
          data.contentText && (() => {
            const lines = data.contentText.split("\n");
            const shown = lines.slice(0, INLINE_CONTENT_PREVIEW_LINE_COUNT);
            const hasMore = lines.length > INLINE_CONTENT_PREVIEW_LINE_COUNT
              || shown.some((line) => line.length > INLINE_CONTENT_PREVIEW_LINE_LENGTH);
            return (
              <div className="text-xs text-zinc-500 font-mono whitespace-pre-wrap wrap-break-word">
                {shown.map((line) => truncate(line, INLINE_CONTENT_PREVIEW_LINE_LENGTH)).join("\n")}
                {hasMore && <span className="text-zinc-600"> ...</span>}
              </div>
            );
          })()
        )}

        {/* Extension badge */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-yellow-950/60 text-yellow-300 border border-yellow-800/40 px-1.5 py-0.5 rounded-md">
            {EXT_LABELS[ext] || ext}
          </span>
          {data.docSubfolder && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-800/60 text-zinc-300 border border-zinc-700/40 px-1.5 py-0.5 rounded-md">
              {data.docSubfolder}
            </span>
          )}
          {isLinked && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 px-1.5 py-0.5 rounded-md">
              linked
            </span>
          )}
        </div>
      </div>

      {/* Doc-out footer */}
      <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-yellow-900/40">
        <span className="text-[9px] font-mono text-yellow-700 tracking-wide uppercase">doc out</span>
        <Zap size={9} className="text-yellow-600 shrink-0" />
      </div>

      {/* Single source-only handle — only valid target is an agent node */}
      <Handle
        type="source"
        position={Position.Right}
        id="doc-out"
        className={HANDLE_CLASS}
        style={{ backgroundColor: NODE_ACCENT.document, top: "auto", bottom: 14 }}
        isValidConnection={isValidAgentConnection}
      />
    </BaseNode>
  );
});


"use client";

import { useCallback, memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";
import { CANVAS_EDGE_STROKE } from "@/lib/theme";

export const DeletableEdge = memo(function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  style,
}: EdgeProps) {
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);

  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };

  const [edgePath, labelX, labelY] =
    edgeStyle === "smoothstep"
      ? getSmoothStepPath({ ...pathParams, borderRadius: 16 })
      : getBezierPath(pathParams);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteEdge(id);
    },
    [id, deleteEdge]
  );

  const strokeColor = selected ? "#e4e4e7" : (style?.stroke as string) ?? CANVAS_EDGE_STROKE;
  const strokeWidth = selected ? 2.5 : (style?.strokeWidth as number) ?? 2;

  return (
    <>
      {/* Wide transparent hit area so the line is easy to click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="cursor-pointer"
      />

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          transition: "stroke 0.12s, stroke-width 0.12s",
          cursor: "pointer",
          ...(selected
            ? {
                strokeDasharray: "8 4",
                animation: "edge-flow 0.5s linear infinite",
              }
            : {}),
          ...style,
        }}
      />

      {/* Delete button — shown when selected */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              zIndex: 10,
            }}
            className="nodrag nopan"
          >
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleDelete}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 border-2 border-red-500/80 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-400 shadow-xl transition-all duration-150 cursor-pointer"
              title="Delete connection"
            >
              <Trash2 size={16} strokeWidth={2.5} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

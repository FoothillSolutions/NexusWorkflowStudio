import { useCallback, useRef, useState } from "react";
import type { NodeChange } from "@xyflow/react";
import type { WorkflowNode } from "@/types/workflow";

/**
 * Tracks drag state to suppress expensive MiniMap renders during node drags.
 * Returns the wrapped onNodesChange handler and isDragging flag.
 */
export function useDragTracking(
  applyChanges: (changes: NodeChange<WorkflowNode>[]) => void
) {
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      const hasDragStart = changes.some(
        (c) => c.type === "position" && c.dragging === true
      );
      const hasDragEnd = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );

      if (hasDragStart && !isDraggingRef.current) {
        isDraggingRef.current = true;
        setIsDragging(true);
      }

      applyChanges(changes);

      if (hasDragEnd && isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    },
    [applyChanges]
  );

  return { onNodesChange, isDragging, isDraggingRef };
}


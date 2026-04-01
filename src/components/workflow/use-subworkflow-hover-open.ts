import { useCallback, useEffect, useRef } from "react";
import type { WorkflowNode } from "@/types/workflow";

interface UseSubWorkflowHoverOpenOptions {
  delayMs?: number;
  getHoveredSubWorkflowId: (draggedNode: WorkflowNode) => string | null;
  moveIntoSubWorkflow: (sourceNodeId: string, targetSubWorkflowNodeId: string) => boolean;
  openSubWorkflow: (nodeId: string) => void;
}

export function useSubWorkflowHoverOpen({
  delayMs = 450,
  getHoveredSubWorkflowId,
  moveIntoSubWorkflow,
  openSubWorkflow,
}: UseSubWorkflowHoverOpenOptions) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTargetRef = useRef<string | null>(null);

  const clearSubWorkflowHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    hoverTargetRef.current = null;
  }, []);

  useEffect(() => clearSubWorkflowHoverTimer, [clearSubWorkflowHoverTimer]);

  const onNodeDragStart = useCallback(() => {
    clearSubWorkflowHoverTimer();
  }, [clearSubWorkflowHoverTimer]);

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: WorkflowNode) => {
      const hoveredSubWorkflowId = getHoveredSubWorkflowId(draggedNode);
      if (!hoveredSubWorkflowId) {
        clearSubWorkflowHoverTimer();
        return;
      }

      if (hoverTargetRef.current === hoveredSubWorkflowId) return;

      clearSubWorkflowHoverTimer();
      hoverTargetRef.current = hoveredSubWorkflowId;
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null;
        const moved = moveIntoSubWorkflow(draggedNode.id, hoveredSubWorkflowId);
        hoverTargetRef.current = null;
        if (!moved) return;
        requestAnimationFrame(() => openSubWorkflow(hoveredSubWorkflowId));
      }, delayMs);
    },
    [clearSubWorkflowHoverTimer, delayMs, getHoveredSubWorkflowId, moveIntoSubWorkflow, openSubWorkflow],
  );

  const onNodeDragStop = useCallback(() => {
    clearSubWorkflowHoverTimer();
  }, [clearSubWorkflowHoverTimer]);

  return {
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  };
}


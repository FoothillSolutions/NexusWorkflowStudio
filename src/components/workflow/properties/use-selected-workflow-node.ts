"use client";

import { useCallback } from "react";
import { useWorkflowStore } from "@/store/workflow";

export function useSelectedWorkflowNode() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);

  const nodeData = useWorkflowStore(
    useCallback(
      (state) => {
        if (!selectedNodeId) return undefined;
        return (
          state.nodes.find((node) => node.id === selectedNodeId)?.data ??
          state.subWorkflowNodes.find((node) => node.id === selectedNodeId)?.data
        );
      },
      [selectedNodeId],
    ),
  );

  const isSubNode = useWorkflowStore(
    useCallback(
      (state) => {
        if (!selectedNodeId) return false;
        return (
          !state.nodes.some((node) => node.id === selectedNodeId) &&
          state.subWorkflowNodes.some((node) => node.id === selectedNodeId)
        );
      },
      [selectedNodeId],
    ),
  );

  return {
    selectedNodeId,
    nodeData,
    isSubNode,
  };
}


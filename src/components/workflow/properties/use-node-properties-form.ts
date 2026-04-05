"use client";

import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { NodeType, WorkflowNodeData } from "@/types/workflow";
import { nodeSchemaMap, NODE_REGISTRY } from "@/lib/node-registry";
import { WorkflowNodeType } from "@/types/workflow";
import { normalizeSwitchBranches } from "@/nodes/switch/branches";

function normalizeNodeFormData(data: WorkflowNodeData | undefined) {
  if (!data) return undefined;
  if (data.type !== WorkflowNodeType.Switch) return data as Record<string, unknown>;

  return {
    ...data,
    branches: normalizeSwitchBranches(data.branches),
  } as Record<string, unknown>;
}

interface UseNodePropertiesFormOptions {
  selectedNodeId: string | null;
  nodeData: WorkflowNodeData | undefined;
  isSubNode: boolean;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  updateSubNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
}

export function useNodePropertiesForm({
  selectedNodeId,
  nodeData,
  isSubNode,
  updateNodeData,
  updateSubNodeData,
}: UseNodePropertiesFormOptions) {
  const nodeType = nodeData?.type as NodeType | undefined;
  const registryEntry = nodeType ? NODE_REGISTRY[nodeType] : null;
  const schema = nodeType ? nodeSchemaMap[nodeType] : undefined;

  const form = useForm({
    // SAFETY: useForm generic inference conflicts with dynamic node schema selection.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: schema ? (zodResolver(schema) as any) : undefined,
    defaultValues: nodeData as Record<string, unknown> | undefined,
    mode: "onChange",
  });

  const watchedValues = useWatch({ control: form.control });
  const readyNodeIdRef = useRef<string | null>(null);
  const previousSelectedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const previousSelectedNodeId = previousSelectedNodeIdRef.current;
    const selectedNodeChanged = previousSelectedNodeId !== selectedNodeId;
    readyNodeIdRef.current = null;

    if (nodeData && registryEntry) {
      const defaults = registryEntry.defaultData() as Record<string, unknown>;
      const normalizedNodeData = normalizeNodeFormData(nodeData);
      const merged = { ...defaults, ...normalizedNodeData } as Record<string, unknown>;
      const nextSignature = JSON.stringify(merged);
      const currentSignature = JSON.stringify(form.getValues());
      if (selectedNodeChanged || currentSignature !== nextSignature) {
        form.reset(merged);
      }
    }

    previousSelectedNodeIdRef.current = selectedNodeId ?? null;

    const nextReadyNodeId = selectedNodeId ?? null;
    const handle = requestAnimationFrame(() => {
      readyNodeIdRef.current = nextReadyNodeId;
    });

    return () => cancelAnimationFrame(handle);
  }, [form, nodeData, registryEntry, selectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId || !watchedValues || !nodeType) return;
    if (readyNodeIdRef.current !== selectedNodeId) return;

    const updatedData = {
      ...watchedValues,
      type: nodeType,
    } as Partial<WorkflowNodeData>;

    if (isSubNode) {
      updateSubNodeData(selectedNodeId, updatedData);
      return;
    }

    updateNodeData(selectedNodeId, updatedData);
  }, [
    isSubNode,
    nodeType,
    selectedNodeId,
    updateNodeData,
    updateSubNodeData,
    watchedValues,
  ]);

  return {
    ...form,
    nodeType,
    registryEntry,
    schema,
  };
}



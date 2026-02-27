"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, Trash2, SlidersHorizontal } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/saved-workflows-store";
import { nodeSchemaMap, NODE_REGISTRY } from "@/lib/node-registry";
import type { NodeType, WorkflowNodeData } from "@/types/workflow";
import { BORDER_DEFAULT, TEXT_MUTED } from "@/lib/theme";
import { TypeSpecificFields } from "./properties";

// ── Main panel ──────────────────────────────────────────────────────────────

export default function PropertiesPanel() {
  const {
    nodes,
    selectedNodeId,
    propertiesPanelOpen,
    closePropertiesPanel,
    updateNodeData,
    setDeleteTarget,
  } = useWorkflowStore();

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const nodeData = selectedNode?.data;
  const nodeType = nodeData?.type as NodeType | undefined;
  const registryEntry = nodeType ? NODE_REGISTRY[nodeType] : null;
  const schema = nodeType ? nodeSchemaMap[nodeType] : null;

  const {
    register,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: schema ? (zodResolver(schema) as any) : undefined,
    defaultValues: nodeData as Record<string, unknown>,
    mode: "onChange",
  });

  const watchedValues = useWatch({ control });

  // Guards stale form writes when switching between nodes.
  // Set to `null` when selectedNodeId changes, then set to the new ID
  // one micro-tick after reset so the *current* render cycle (which still
  // carries the previous node's watchedValues) is skipped.
  const readyNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Block writes immediately — watchedValues in this commit are stale
    readyNodeIdRef.current = null;

    if (nodeData && registryEntry) {
      const defaults = registryEntry.defaultData() as Record<string, unknown>;
      const merged = { ...defaults, ...nodeData } as Record<string, unknown>;
      reset(merged);
    }

    // Enable writes only after React has flushed the re-render caused by
    // reset(), so watchedValues reflects the *new* node's data.
    const id = selectedNodeId ?? null;
    const handle = requestAnimationFrame(() => {
      readyNodeIdRef.current = id;
    });
    return () => cancelAnimationFrame(handle);
  }, [selectedNodeId, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedNodeId || !watchedValues || !nodeType) return;
    // Skip until the form has been reset AND a full render cycle has passed
    if (readyNodeIdRef.current !== selectedNodeId) return;
    const updatedData = { ...watchedValues, type: nodeType } as Partial<WorkflowNodeData>;
    updateNodeData(selectedNodeId, updatedData);
  }, [watchedValues, selectedNodeId, nodeType, updateNodeData]);

  const handleDelete = useCallback(() => {
    if (selectedNodeId) {
      setDeleteTarget({ type: "node", id: selectedNodeId });
    }
  }, [selectedNodeId, setDeleteTarget]);

  // Close library sidebar when properties panel opens (mutual exclusion)
  useEffect(() => {
    if (propertiesPanelOpen && selectedNode && nodeData && registryEntry) {
      useSavedWorkflowsStore.getState().closeSidebar();
    }
  }, [propertiesPanelOpen, selectedNode, nodeData, registryEntry]);

  const isVisible = propertiesPanelOpen && !!selectedNode && !!nodeData && !!registryEntry;

  if (!isVisible) {
    if (selectedNode && selectedNodeId) {
      return (
        <div className="absolute bottom-6 right-4 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useWorkflowStore.getState().openPropertiesPanel(selectedNodeId)}
            className={`h-9 w-9 rounded-xl bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-sm shadow-lg ${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800/80 transition-all duration-200`}
          >
            <SlidersHorizontal size={16} />
          </Button>
        </div>
      );
    }
    return null;
  }

  const Icon = registryEntry!.icon;
  const nameAsbadge = true;

  return (
    <div
      className="absolute top-4 right-4 z-20 flex flex-col rounded-2xl border border-zinc-700/50 bg-zinc-900/85 backdrop-blur-md shadow-2xl overflow-hidden animate-in slide-in-from-top-4 fade-in-0 duration-200"
      style={{ width: 320, height: "calc(100vh - 112px)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-700/50 shrink-0">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
          style={{ backgroundColor: `${registryEntry.accentHex}20` }}
        >
          <Icon className="h-4 w-4" style={{ color: registryEntry.accentHex }} />
        </div>
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <span className="text-sm font-semibold text-zinc-100 truncate">
            {registryEntry.displayName}
          </span>
          {nameAsbadge && nodeData?.name && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] px-1.5 py-0 h-4 w-fit border-zinc-600 text-zinc-400 truncate max-w-full"
            >
              {nodeData.name}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={closePropertiesPanel}
          className={`h-7 w-7 rounded-lg ${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0`}
        >
          <X size={14} />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <form className="space-y-4 p-4" onSubmit={(e) => e.preventDefault()}>
          {/* Node Name — only shown for non-badge node types */}
          {!nameAsbadge && (
            <div className="space-y-2">
              <Label htmlFor="node-name">Node Name</Label>
              <Input
                id="node-name"
                placeholder="e.g. my-prompt"
                className="bg-zinc-800/60 border-zinc-700/60 rounded-xl text-sm font-mono focus-visible:ring-zinc-600"
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-xs text-destructive">
                  {errors.name.message as string}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Only letters, numbers, hyphens, and underscores
                </p>
              )}
            </div>
          )}

          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="node-label">Label</Label>
            <Input
              id="node-label"
              placeholder="Node label"
              className="bg-zinc-800/60 border-zinc-700/60 rounded-xl text-sm focus-visible:ring-zinc-600"
              {...register("label")}
            />
            {errors.label && (
              <p className="text-xs text-destructive">
                {errors.label.message as string}
              </p>
            )}
          </div>

          {/* Type-specific fields */}
          <TypeSpecificFields
            nodeType={nodeType!}
            register={register}
            control={control}
            setValue={setValue}
            errors={errors}
            selectedNodeId={selectedNodeId ?? undefined}
          />

          <Separator className={BORDER_DEFAULT} />

          {nodeType !== "start" && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full gap-2 rounded-xl"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Node
            </Button>
          )}
        </form>
      </ScrollArea>
    </div>
  );
}

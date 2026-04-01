"use client";

import { useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Trash2, SlidersHorizontal } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import { useSavedWorkflowsStore } from "@/store/library";
import { WorkflowNodeType } from "@/types/workflow";
import {
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SUBTLE,
} from "@/lib/theme";
import {
  WORKFLOW_PANEL_SURFACE_CLASS,
  buildWorkflowIconToggleButtonClass,
  buildWorkflowPanelShellClass,
} from "./panel-primitives";
import { TypeSpecificFields } from "./properties";
import { cn } from "@/lib/utils";
import { useNodePropertiesForm } from "./properties/use-node-properties-form";
import { useSelectedWorkflowNode } from "./properties/use-selected-workflow-node";

const PANEL_SHELL_CLASS = buildWorkflowPanelShellClass("top-4 right-4");
const PANEL_SURFACE_CLASS = WORKFLOW_PANEL_SURFACE_CLASS;
const TOGGLE_BUTTON_CLASS = buildWorkflowIconToggleButtonClass(TEXT_MUTED);

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1 px-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {eyebrow}
      </div>
      <div className={cn("text-sm font-semibold", TEXT_PRIMARY)}>{title}</div>
      {description && <p className={cn("text-xs leading-5", TEXT_SUBTLE)}>{description}</p>}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────

export default function PropertiesPanel() {
  const propertiesPanelOpen = useWorkflowStore((s) => s.propertiesPanelOpen);
  const closePropertiesPanel = useWorkflowStore((s) => s.closePropertiesPanel);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const updateSubNodeData = useWorkflowStore((s) => s.updateSubNodeData);
  const setDeleteTarget = useWorkflowStore((s) => s.setDeleteTarget);
  const activeSubWorkflowNodeId = useWorkflowStore((s) => s.activeSubWorkflowNodeId);
  const { selectedNodeId, nodeData, isSubNode } = useSelectedWorkflowNode();
  const {
    register,
    control,
    setValue,
    nodeType,
    registryEntry,
    formState: { errors },
  } = useNodePropertiesForm({
    selectedNodeId,
    nodeData,
    isSubNode,
    updateNodeData,
    updateSubNodeData,
  });

  const handleDelete = useCallback(() => {
    if (selectedNodeId) {
      setDeleteTarget({
        type: "node",
        id: selectedNodeId,
        scope: isSubNode ? "subworkflow" : "root",
      });
    }
  }, [isSubNode, selectedNodeId, setDeleteTarget]);

  // Close library sidebar when properties panel opens (mutual exclusion)
  useEffect(() => {
    if (propertiesPanelOpen && nodeData && registryEntry) {
      useSavedWorkflowsStore.getState().closeSidebar();
    }
  }, [propertiesPanelOpen, nodeData, registryEntry]);

  const isVisible = propertiesPanelOpen && !!selectedNodeId && !!nodeData && !!registryEntry;

  if (!isVisible) {
    if (selectedNodeId && nodeData) {
      return (
        <div className="absolute bottom-6 right-4 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useWorkflowStore.getState().openPropertiesPanel(selectedNodeId)}
            className={TOGGLE_BUTTON_CLASS}
          >
            <SlidersHorizontal size={16} />
          </Button>
        </div>
      );
    }
    return null;
  }

  const Icon = registryEntry!.icon;

  return (
    <div
      className={`${PANEL_SHELL_CLASS} select-text animate-in slide-in-from-top-4 fade-in-0 duration-200`}
      style={{ width: "min(380px, calc(100vw - 32px))", height: activeSubWorkflowNodeId ? "calc(100% - 32px)" : "calc(100vh - 112px)" }}
    >
      {/* Header */}
      <div className="relative shrink-0 border-b border-zinc-800/80 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-zinc-900/75 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <Icon size={15} style={{ color: registryEntry.accentHex }} />
          </div>
          <div className="min-w-0 pr-10">
            <div className={cn("text-sm font-semibold", TEXT_PRIMARY)}>Properties</div>
            <div className={cn("truncate text-xs", TEXT_SUBTLE)}>
              {registryEntry.displayName}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={closePropertiesPanel}
          className={`absolute right-3 top-3 h-8 w-8 rounded-xl border border-zinc-700/60 bg-zinc-950/70 ${TEXT_MUTED} hover:border-zinc-600/80 hover:bg-zinc-800/80 hover:text-zinc-100`}
        >
          <X size={15} />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0 w-full" viewportClassName="min-h-0 select-text">
        <form className="space-y-3 p-3 pb-4 select-text" onSubmit={(e) => e.preventDefault()}>
          <section className={`${PANEL_SURFACE_CLASS} relative overflow-hidden p-3`}>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-100"
              style={{ background: `linear-gradient(180deg, ${registryEntry.accentHex}18 0%, transparent 100%)` }}
            />

            <div className="relative flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/5"
                style={{ backgroundColor: `${registryEntry.accentHex}16` }}
              >
                <Icon size={18} style={{ color: registryEntry.accentHex }} />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <div className={cn("truncate text-sm font-semibold", TEXT_PRIMARY)}>
                    {nodeData.label?.trim() || registryEntry.displayName}
                  </div>
                  <p className={cn("mt-1 text-xs leading-5", TEXT_SUBTLE)}>
                    {registryEntry.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className="h-auto min-w-0 max-w-full whitespace-normal break-all rounded-full border-zinc-700/70 bg-zinc-950/70 px-2 py-1 text-left font-mono text-[10px] font-medium leading-4 text-zinc-400"
                    title={selectedNodeId}
                  >
                    {selectedNodeId}
                  </Badge>
                </div>
              </div>
            </div>
          </section>

          <section className={`${PANEL_SURFACE_CLASS} space-y-3 p-3`}>
            <SectionIntro
              eyebrow="General"
              title="Base settings"
              description="Update the node label and keep the block readable on the canvas."
            />

            <div className="space-y-2">
              <Label htmlFor="node-label" className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                Label
              </Label>
              <Input
                id="node-label"
                placeholder="Give this node a concise label"
                className={cn(
                  "h-10 rounded-xl border-zinc-700/70 bg-zinc-950/75 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-500/50",
                  errors.label && "border-red-500/50 focus-visible:ring-red-500/40",
                )}
                {...register("label")}
              />
              <p className={cn("text-xs leading-5", errors.label ? "text-red-300" : TEXT_SUBTLE)}>
                {errors.label?.message
                  ? (errors.label.message as string)
                  : "This title appears on the node card inside your workflow."}
              </p>
            </div>
          </section>

          <section className={`${PANEL_SURFACE_CLASS} space-y-3 p-3`}>
            <SectionIntro
              eyebrow="Configuration"
              title="Node behavior"
              description="Adjust the fields below to control how this node runs inside the workflow."
            />

            <div className="space-y-4">
              <TypeSpecificFields
                nodeType={nodeType!}
                register={register}
                control={control}
                setValue={setValue}
                errors={errors}
                selectedNodeId={selectedNodeId ?? undefined}
              />
            </div>
          </section>

          {nodeType !== WorkflowNodeType.Start && (
            <section className={`${PANEL_SURFACE_CLASS} p-3`}>
              <SectionIntro
                eyebrow="Danger zone"
                title="Remove node"
                description="Delete this node from the current canvas when you no longer need it."
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 w-full gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 transition-colors hover:border-red-500/35 hover:bg-red-500/15 hover:text-red-100"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Node
              </Button>
            </section>
          )}
        </form>
      </ScrollArea>
    </div>
  );
}

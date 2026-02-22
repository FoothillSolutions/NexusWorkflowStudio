"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Trash2 } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";
import { nodeSchemaMap } from "@/lib/schemas";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { NodeType, WorkflowNodeData } from "@/types/workflow";

// ── Field components per node type ──────────────────────────────────────────

function PromptFields({
  register,
}: {
  register: ReturnType<typeof useForm>["register"];
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="promptText">Prompt Text</Label>
        <Textarea
          id="promptText"
          rows={6}
          placeholder="Enter your prompt template…"
          className="resize-none font-mono text-sm"
          {...register("promptText")}
        />
        <p className="text-xs text-muted-foreground">
          Use {"{{variable}}"} syntax for template variables.
        </p>
      </div>
    </>
  );
}

function SubAgentFields({
  register,
}: {
  register: ReturnType<typeof useForm>["register"];
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="agentName">Agent Name</Label>
        <Input
          id="agentName"
          placeholder="e.g. code-reviewer"
          {...register("agentName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="taskText">Task Description</Label>
        <Textarea
          id="taskText"
          rows={4}
          placeholder="Describe the agent's task…"
          className="resize-none"
          {...register("taskText")}
        />
      </div>
    </>
  );
}

function SubAgentFlowFields({
  register,
}: {
  register: ReturnType<typeof useForm>["register"];
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="flowRef">Flow Reference</Label>
        <Input
          id="flowRef"
          placeholder="Referenced workflow name or ID"
          {...register("flowRef")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nodeCount">Node Count</Label>
        <Input
          id="nodeCount"
          type="number"
          min={0}
          {...register("nodeCount", { valueAsNumber: true })}
        />
      </div>
    </>
  );
}

function SkillFields({
  register,
}: {
  register: ReturnType<typeof useForm>["register"];
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="skillName">Skill Name</Label>
        <Input
          id="skillName"
          placeholder="e.g. playwright"
          {...register("skillName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectName">Project Name</Label>
        <Input
          id="projectName"
          placeholder="e.g. my-app"
          {...register("projectName")}
        />
      </div>
    </>
  );
}

function McpToolFields({
  register,
}: {
  register: ReturnType<typeof useForm>["register"];
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="toolName">Tool Name</Label>
        <Input
          id="toolName"
          placeholder="e.g. read_file"
          {...register("toolName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paramsText">Parameters (JSON)</Label>
        <Textarea
          id="paramsText"
          rows={4}
          placeholder='{"path": "/src/index.ts"}'
          className="resize-none font-mono text-sm"
          {...register("paramsText")}
        />
      </div>
    </>
  );
}

function IfElseFields({
  register,
}: {
  register: ReturnType<typeof useForm>["register"];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="expression">Condition Expression</Label>
      <Input
        id="expression"
        placeholder='e.g. result.status === "success"'
        className="font-mono text-sm"
        {...register("expression")}
      />
    </div>
  );
}

function SwitchFields({
  register,
  control,
}: {
  register: ReturnType<typeof useForm>["register"];
  control: ReturnType<typeof useForm>["control"];
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    // cases is string[], so useFieldArray won't work directly.
    // We need a workaround — useFieldArray expects objects.
    // Instead, we'll manage cases with the watch/setValue pattern.
    name: "cases" as never,
  });

  // useFieldArray with string arrays: each field gets { id, ... }
  // but since our schema has string[], we pass name as "cases"
  // react-hook-form v7 handles string arrays in useFieldArray

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="switchExpr">Switch Expression</Label>
        <Input
          id="switchExpr"
          placeholder='e.g. input.category'
          className="font-mono text-sm"
          {...register("switchExpr")}
        />
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Cases</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => append(`Case ${fields.length + 1}`)}
          >
            <Plus className="h-3 w-3" />
            Add Case
          </Button>
        </div>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input
                placeholder={`Case ${index + 1}`}
                className="text-sm"
                {...register(`cases.${index}` as const)}
              />
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          A &quot;Default&quot; output handle is always present.
        </p>
      </div>
    </>
  );
}

function AskUserFields({
  register,
  control,
}: {
  register: ReturnType<typeof useForm>["register"];
  control: ReturnType<typeof useForm>["control"];
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "options" as never,
  });

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="questionText">Question Text</Label>
        <Textarea
          id="questionText"
          rows={3}
          placeholder="What would you like to do?"
          className="resize-none"
          {...register("questionText")}
        />
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Options</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => append(`Option ${fields.length + 1}`)}
          >
            <Plus className="h-3 w-3" />
            Add Option
          </Button>
        </div>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${index + 1}`}
                className="text-sm"
                {...register(`options.${index}` as const)}
              />
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Type-specific field renderer ────────────────────────────────────────────

function TypeSpecificFields({
  nodeType,
  register,
  control,
}: {
  nodeType: NodeType;
  register: ReturnType<typeof useForm>["register"];
  control: ReturnType<typeof useForm>["control"];
}) {
  switch (nodeType) {
    case "prompt":
      return <PromptFields register={register} />;
    case "sub-agent":
      return <SubAgentFields register={register} />;
    case "sub-agent-flow":
      return <SubAgentFlowFields register={register} />;
    case "skill":
      return <SkillFields register={register} />;
    case "mcp-tool":
      return <McpToolFields register={register} />;
    case "if-else":
      return <IfElseFields register={register} />;
    case "switch":
      return <SwitchFields register={register} control={control} />;
    case "ask-user":
      return <AskUserFields register={register} control={control} />;
    case "start":
    case "end":
    default:
      return null;
  }
}

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

  // Find selected node
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const nodeData = selectedNode?.data;
  const nodeType = nodeData?.type as NodeType | undefined;
  const registryEntry = nodeType ? NODE_REGISTRY[nodeType] : null;

  // Resolve schema
  const schema = nodeType ? nodeSchemaMap[nodeType] : null;

  // Form setup
  const {
    register,
    control,
    reset,
    formState: { errors },
  } = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: schema ? (zodResolver(schema) as any) : undefined,
    defaultValues: nodeData as Record<string, unknown>,
    mode: "onChange",
  });

  // Watch all form values for live sync to store
  const watchedValues = useWatch({ control });

  // Reset form when selected node changes
  useEffect(() => {
    if (nodeData) {
      reset(nodeData as Record<string, unknown>);
    }
  }, [selectedNodeId, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync watched values → store (debounce via useEffect batching)
  useEffect(() => {
    if (!selectedNodeId || !watchedValues || !nodeType) return;

    // Merge watched values with the original type field to preserve it
    const updatedData = {
      ...watchedValues,
      type: nodeType,
    } as Partial<WorkflowNodeData>;

    updateNodeData(selectedNodeId, updatedData);
  }, [watchedValues, selectedNodeId, nodeType, updateNodeData]);

  // Delete handler
  const handleDelete = useCallback(() => {
    if (selectedNodeId) {
      setDeleteTarget({ type: "node", id: selectedNodeId });
    }
  }, [selectedNodeId, setDeleteTarget]);

  if (!propertiesPanelOpen || !selectedNode || !nodeData || !registryEntry) {
    return null;
  }

  const Icon = registryEntry.icon;

  return (
    <Sheet open={propertiesPanelOpen} onOpenChange={(open) => !open && closePropertiesPanel()} modal={false}>
      <SheetContent
        side="right"
        className="w-[380px] sm:max-w-[380px] overflow-hidden border-zinc-800 bg-zinc-950"
        showCloseButton
      >
        <SheetHeader className="px-4 pt-4 pb-0">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ backgroundColor: `${registryEntry.accentHex}20` }}
            >
              <Icon
                className="h-4 w-4"
                style={{ color: registryEntry.accentHex }}
              />
            </div>
            <SheetTitle className="text-sm font-semibold">
              {registryEntry.displayName}
            </SheetTitle>
            <Badge
              variant="outline"
              className="ml-auto text-[10px] font-mono text-muted-foreground"
            >
              {selectedNode.id}
            </Badge>
          </div>
          <SheetDescription className="sr-only">
            Edit properties for {registryEntry.displayName} node
          </SheetDescription>
        </SheetHeader>

        <Separator className="bg-zinc-800" />

        <ScrollArea className="flex-1 px-4 pb-4">
          <form
            className="space-y-4"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Common: Label */}
            <div className="space-y-2">
              <Label htmlFor="node-label">Label</Label>
              <Input
                id="node-label"
                placeholder="Node label"
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
            />

            <Separator className="bg-zinc-800" />

            {/* Delete button */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full gap-2"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Node
            </Button>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

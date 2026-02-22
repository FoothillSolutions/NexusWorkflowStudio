"use client";

import { useEffect, useCallback, useMemo } from "react";
import {useForm, useFieldArray, useWatch, Controller} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Trash2, SlidersHorizontal } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";
import { nodeSchemaMap } from "@/lib/schemas";
import { NODE_REGISTRY } from "@/lib/node-types";
import type { NodeType, WorkflowNodeData } from "@/types/workflow";
import { BORDER_DEFAULT, TEXT_MUTED } from "@/lib/theme";
import {MarkdownEditor} from "@/components/ui/markdown-editor";

// ── Field components per node type ──────────────────────────────────────────

function PromptFields({
  control,
}: {
  register: ReturnType<typeof useForm>["register"];
  control: ReturnType<typeof useForm>["control"];
  errors: ReturnType<typeof useForm>["formState"]["errors"];
  section?: "top" | "bottom" | "all";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="promptText">Prompt</Label>
      <Controller
        name="promptText"
        control={control}
        render={({ field }) => (
          <MarkdownEditor
            value={field.value ?? ""}
            onChange={field.onChange}
            height={200}
          />
        )}
      />
    </div>
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
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("agentName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="taskText">Task Description</Label>
        <Textarea
          id="taskText"
          rows={4}
          placeholder="Describe the agent's task…"
          className="resize-none bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("flowRef")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nodeCount">Node Count</Label>
        <Input
          id="nodeCount"
          type="number"
          min={0}
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("skillName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectName">Project Name</Label>
        <Input
          id="projectName"
          placeholder="e.g. my-app"
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
          className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
          {...register("toolName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paramsText">Parameters (JSON)</Label>
        <Textarea
          id="paramsText"
          rows={4}
          placeholder='{"path": "/src/index.ts"}'
          className="resize-none font-mono text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
        className="font-mono text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
          className="font-mono text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
                className="text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
          className="resize-none bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
                className="text-sm bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600"
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
  errors,
}: {
  nodeType: NodeType;
  register: ReturnType<typeof useForm>["register"];
  control: ReturnType<typeof useForm>["control"];
  errors: ReturnType<typeof useForm>["formState"]["errors"];
}) {
  switch (nodeType) {
    case "prompt":
      return <PromptFields register={register} control={control} errors={errors} />;
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
    // Show a small floating icon when the panel is hidden but a node is selected
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

  const Icon = registryEntry.icon;

  return (
    <>
      {/* Floating properties panel */}
      <div
        className="absolute top-4 right-4 z-20 flex flex-col rounded-2xl border border-zinc-700/50 bg-zinc-900/85 backdrop-blur-md shadow-2xl"
        style={{ width: 320, maxHeight: "calc(100vh - 112px)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-700/50 shrink-0">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
            style={{ backgroundColor: `${registryEntry.accentHex}20` }}
          >
            <Icon className="h-4 w-4" style={{ color: registryEntry.accentHex }} />
          </div>
          <span className="text-sm font-semibold text-zinc-100 truncate flex-1">
            {registryEntry.displayName}
          </span>
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
            {/* Node Name — editable identifier */}
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

            {/* Label — shown on the node card */}
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
              errors={errors}
            />

            <Separator className={BORDER_DEFAULT} />

            {/* Delete button — hidden for the protected Start node */}
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
    </>
  );
}

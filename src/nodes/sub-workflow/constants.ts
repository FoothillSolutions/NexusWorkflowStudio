import { customAlphabet } from "nanoid";
import { GitBranch } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import { SubAgentModel, SubAgentMemory } from "@/nodes/agent/enums";
import { WorkflowNodeType, type WorkflowNode, type WorkflowNodeData } from "@/types/workflow";
import type { SubWorkflowNodeData } from "./types";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

function createSubWorkflowBoundaryNode(
  type: WorkflowNodeType.Start | WorkflowNodeType.End,
  position: { x: number; y: number },
): WorkflowNode {
  const id = `${type}-sub-${nanoid(8)}`;
  return {
    id,
    type,
    position,
    data: {
      type,
      label: type === WorkflowNodeType.Start ? "Start" : "End",
      name: id,
    } as WorkflowNodeData,
    ...(type === WorkflowNodeType.Start ? { deletable: false } : {}),
  } as WorkflowNode;
}

export function createDefaultSubWorkflowContents(): Pick<SubWorkflowNodeData, "subNodes" | "subEdges" | "nodeCount"> {
  const subNodes = [
    createSubWorkflowBoundaryNode(WorkflowNodeType.Start, { x: 80, y: 200 }),
    createSubWorkflowBoundaryNode(WorkflowNodeType.End, { x: 600, y: 200 }),
  ];

  return {
    subNodes,
    subEdges: [],
    nodeCount: subNodes.length,
  };
}

export function normalizeSubWorkflowContents(
  data?: Partial<Pick<SubWorkflowNodeData, "subNodes" | "subEdges" | "nodeCount">>,
): Pick<SubWorkflowNodeData, "subNodes" | "subEdges" | "nodeCount"> {
  if ((data?.subNodes?.length ?? 0) >= 2) {
    return {
      subNodes: data?.subNodes ?? [],
      subEdges: data?.subEdges ?? [],
      nodeCount: data?.subNodes?.length ?? 0,
    };
  }

  return createDefaultSubWorkflowContents();
}

export const subWorkflowRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.SubWorkflow,
  displayName: "Sub Workflow",
  description: "Embed a sub-workflow",
  icon: GitBranch,
  accentColor: "purple",
  accentHex: NODE_ACCENT["sub-workflow"],
  category: NodeCategory.Basic,
  size: NodeSize.Large,
  defaultData: (): SubWorkflowNodeData => ({
    type: WorkflowNodeType.SubWorkflow,
    label: "Sub Workflow",
    name: "",
    mode: "same-context",
    ...normalizeSubWorkflowContents(),
    description: "",
    model: SubAgentModel.Inherit,
    memory: SubAgentMemory.Default,
    temperature: 0,
    color: NODE_ACCENT["sub-workflow"],
    disabledTools: [],
  }),
  aiGenerationPrompt: {
    description: "Embed a sub-workflow with its own inner nodes and edges. Use when you need to group or reuse a multi-step flow, especially when the inner work is primarily sequential rather than parallel.",
    dataTemplate: `{"type":"sub-workflow","label":"<label>","name":"<id>","mode":"same-context","subNodes":[],"subEdges":[],"nodeCount":0,"description":"","model":"inherit","memory":"default","temperature":0,"color":"#a855f7","disabledTools":[]}`,
    requiredFields: [
      { field: "type", description: 'Must be "sub-workflow"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "mode", description: '"same-context" (runs inline, shares parent context) or "agent" (spawns a dedicated sub-agent)' },
      { field: "subNodes", description: "Inner workflow nodes following the same node schema as top-level nodes. MUST contain at least a start and end node." },
      { field: "subEdges", description: "Inner workflow edges connecting the inner nodes, same format as top-level edges" },
      { field: "nodeCount", description: "Must equal the number of subNodes" },
    ],
    optionalFields: [
      { field: "description", description: 'Agent description (when mode is "agent")', default: '""' },
      { field: "model", description: 'Model ID (when mode is "agent")', default: '"inherit"' },
      { field: "memory", description: 'Memory mode (when mode is "agent")', default: '"default"' },
      { field: "temperature", description: 'Temperature (when mode is "agent")', default: "0" },
      { field: "color", description: "Hex color", default: '"#a855f7"' },
      { field: "disabledTools", description: 'Tools to disable (when mode is "agent")', default: "[]" },
    ],
    generationHints: [
      'When mode is "agent", fill in description, model, memory, temperature, and color.',
      "subNodes and subEdges define the INNER workflow. They follow the exact same node/edge schema as top-level nodes/edges.",
      "A sub-workflow MUST contain at least a start node and an end node inside subNodes, plus any other nodes (agents, prompts, if-else, etc.) that form the inner flow.",
      'Use mode "same-context" for simple inline grouping, and mode "agent" when the sub-workflow should run as an independent agent with its own model and description.',
      "Sub-workflows must always contain at least a start and end node inside subNodes, with subEdges connecting the inner flow.",
    ],
    examples: [
`Example with inner nodes: {"type":"sub-workflow","label":"Data Pipeline","name":"sub-wf-abc","mode":"agent","description":"Handles data ingestion","subNodes":[{"id":"start-inner","type":"start","position":{"x":0,"y":200},"data":{"type":"start","label":"Start","name":"start-inner"}},{"id":"agent-inner","type":"agent","position":{"x":400,"y":200},"data":{"type":"agent","label":"Process Data","name":"agent-inner","description":"Processes incoming data","promptText":"Process and validate the data...","detectedVariables":[],"model":"inherit","memory":"-","temperature":0,"color":"#5f27cd","disabledTools":[]}},{"id":"end-inner","type":"end","position":{"x":800,"y":200},"data":{"type":"end","label":"End","name":"end-inner"}}],"subEdges":[{"id":"e-start-agent","source":"start-inner","target":"agent-inner","type":"deletable"},{"id":"e-agent-end","source":"agent-inner","target":"end-inner","type":"deletable"}],"nodeCount":3,"model":"inherit","memory":"default","temperature":0,"color":"#a855f7","disabledTools":[]}`,
    ],
  },
};

export const subWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  mode: z.enum(["same-context", "agent"]).default("same-context"),
  subNodes: z.array(z.any()).default([]),
  subEdges: z.array(z.any()).default([]),
  nodeCount: z.coerce.number().int().min(0),
  // Agent-mode fields
  description: z.string().default(""),
  model: z.string().default(SubAgentModel.Inherit),
  memory: z.enum(SubAgentMemory).default(SubAgentMemory.Default),
  temperature: z.number().min(0).max(1).default(0),
  color: z.string().default(NODE_ACCENT["sub-workflow"]),
  disabledTools: z.array(z.string()).default([]),
});


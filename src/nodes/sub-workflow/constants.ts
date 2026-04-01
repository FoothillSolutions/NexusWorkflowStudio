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


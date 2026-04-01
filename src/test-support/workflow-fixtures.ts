import { SubAgentMemory, SubAgentModel } from "@/nodes/agent/enums";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflow";

export function makeWorkflowNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: overrides.id ?? "node-1",
    type: overrides.type ?? "prompt",
    position: overrides.position ?? { x: 0, y: 0 },
    data:
      overrides.data ??
      ({ type: "prompt", label: "Prompt", name: overrides.id ?? "node-1" } as WorkflowNode["data"]),
    ...overrides,
  } as WorkflowNode;
}

export function makeWorkflowEdge(overrides: Partial<WorkflowEdge> = {}): WorkflowEdge {
  return {
    id: overrides.id ?? "edge-1",
    source: overrides.source ?? "a",
    target: overrides.target ?? "b",
    type: overrides.type ?? "deletable",
    ...overrides,
  } as WorkflowEdge;
}

export function makeSubWorkflowNode(
  id: string,
  subNodes: WorkflowNode[],
  subEdges: WorkflowEdge[] = [],
  overrides: Partial<WorkflowNode> = {},
): WorkflowNode {
  return makeWorkflowNode({
    id,
    type: "sub-workflow",
    data: {
      type: "sub-workflow",
      label: id,
      name: id,
      mode: "same-context",
      description: "",
      subNodes,
      subEdges,
      nodeCount: subNodes.length,
      model: SubAgentModel.Inherit,
      memory: SubAgentMemory.Default,
      temperature: 0,
      color: "#000000",
      disabledTools: [],
    } as WorkflowNode["data"],
    ...overrides,
  });
}


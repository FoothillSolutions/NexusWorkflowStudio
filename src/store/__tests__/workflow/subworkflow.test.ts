import { describe, expect, it } from "bun:test";
import { SubAgentMemory, SubAgentModel } from "@/nodes/agent/enums";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflow";
import {
  resolveParentNodes,
  updateNestedSubWorkflowEdges,
  updateNestedSubWorkflowNodes,
} from "../../workflow";

function makeNode(overrides: Partial<WorkflowNode>): WorkflowNode {
  return {
    id: overrides.id ?? "node-1",
    type: overrides.type ?? "prompt",
    position: overrides.position ?? { x: 0, y: 0 },
    data:
      overrides.data ??
      ({ type: "prompt", label: "Prompt", name: "node-1" } as WorkflowNode["data"]),
    ...overrides,
  } as WorkflowNode;
}

function makeSubWorkflowNode(
  id: string,
  subNodes: WorkflowNode[],
  subEdges: WorkflowEdge[] = [],
): WorkflowNode {
  return makeNode({
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
  });
}

describe("workflow subworkflow helpers", () => {
  it("resolves parent nodes for nested breadcrumb stacks", () => {
    const nestedNode = makeNode({
      id: "prompt-1",
      data: { type: "prompt", label: "Nested Prompt", name: "prompt-1" } as WorkflowNode["data"],
    });
    const childSubWorkflow = makeSubWorkflowNode("child", [nestedNode]);
    const rootSubWorkflow = makeSubWorkflowNode("root", [childSubWorkflow]);
    const rootNodes = [rootSubWorkflow];

    expect(resolveParentNodes(rootNodes, [{ nodeId: "root", label: "root" }])).toBe(rootNodes);
    expect(
      resolveParentNodes(rootNodes, [
        { nodeId: "root", label: "root" },
        { nodeId: "child", label: "child" },
      ]),
    ).toEqual((rootSubWorkflow.data as Extract<WorkflowNode["data"], { type: "sub-workflow" }>).subNodes);
  });

  it("updates nested subworkflow nodes along an ancestor path", () => {
    const replacementNode = makeNode({
      id: "prompt-2",
      data: { type: "prompt", label: "Replacement", name: "prompt-2" } as WorkflowNode["data"],
    });
    const childSubWorkflow = makeSubWorkflowNode("child", []);
    const rootSubWorkflow = makeSubWorkflowNode("root", [childSubWorkflow]);

    const updated = updateNestedSubWorkflowNodes(
      [rootSubWorkflow],
      ["root", "child"],
      [replacementNode],
    );
    const rootData = updated[0].data as Extract<WorkflowNode["data"], { type: "sub-workflow" }>;
    const childData = rootData.subNodes[0].data as Extract<WorkflowNode["data"], { type: "sub-workflow" }>;

    expect(childData.subNodes).toEqual([replacementNode]);
    expect(childData.nodeCount).toBe(1);
  });

  it("updates nested subworkflow edges at the targeted ancestor path", () => {
    const childSubWorkflow = makeSubWorkflowNode("child", []);
    const rootSubWorkflow = makeSubWorkflowNode("root", [childSubWorkflow]);
    const nextEdges: WorkflowEdge[] = [
      {
        id: "edge-1",
        source: "start",
        target: "end",
        type: "deletable",
      } as WorkflowEdge,
    ];

    const updated = updateNestedSubWorkflowEdges(
      [rootSubWorkflow],
      ["root", "child"],
      nextEdges,
    );
    const rootData = updated[0].data as Extract<WorkflowNode["data"], { type: "sub-workflow" }>;
    const childData = rootData.subNodes[0].data as Extract<WorkflowNode["data"], { type: "sub-workflow" }>;

    expect(childData.subEdges).toEqual(nextEdges);
  });
});



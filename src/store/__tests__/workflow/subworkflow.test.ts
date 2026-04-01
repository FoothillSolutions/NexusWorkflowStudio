import { describe, expect, it } from "bun:test";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflow";
import {
  makeSubWorkflowNode,
  makeWorkflowNode,
} from "@/test-support/workflow-fixtures";
import {
  resolveParentNodes,
  updateNestedSubWorkflowEdges,
  updateNestedSubWorkflowNodes,
} from "../../workflow";

describe("workflow subworkflow helpers", () => {
  it("resolves parent nodes for nested breadcrumb stacks", () => {
    const nestedNode = makeWorkflowNode({
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
    const replacementNode = makeWorkflowNode({
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



import { describe, expect, it } from "bun:test";
import { makeSubWorkflowNode, makeWorkflowEdge, makeWorkflowNode } from "@/test-support/workflow-fixtures";
import { WorkflowNodeType, type WorkflowNode } from "@/types/workflow";
import {
  detachNodeFromContext,
  moveNodeIntoSubWorkflowContext,
} from "../subworkflow-transfer";

describe("subworkflow transfer", () => {
  it("detaches a node from its current context and removes connected edges", () => {
    const sourceNode = makeWorkflowNode({
      id: "agent-1",
      type: WorkflowNodeType.Agent,
      data: { type: WorkflowNodeType.Agent, label: "Agent", name: "agent-1" } as WorkflowNode["data"],
    });
    const siblingNode = makeWorkflowNode({
      id: "prompt-1",
      type: WorkflowNodeType.Prompt,
      data: { type: WorkflowNodeType.Prompt, label: "Prompt", name: "prompt-1" } as WorkflowNode["data"],
    });

    const result = detachNodeFromContext({
      nodes: [sourceNode, siblingNode],
      edges: [
        makeWorkflowEdge({ id: "edge-1", source: "agent-1", target: "prompt-1" }),
        makeWorkflowEdge({ id: "edge-2", source: "prompt-1", target: "agent-1" }),
      ],
      sourceNodeId: "agent-1",
    });

    expect(result.detached).toBe(true);
    expect(result.node?.id).toBe("agent-1");
    expect(result.node?.selected).toBe(false);
    expect(result.node?.data.name).toBe("agent-1");
    expect(result.nodes.map((node) => node.id)).toEqual(["prompt-1"]);
    expect(result.edges).toEqual([]);
  });

  it("adds scaffold nodes when moving into an empty sub-workflow", () => {
    const sourceNode = makeWorkflowNode({
      id: "skill-1",
      type: "skill",
      position: { x: 50, y: 50 },
      data: { type: "skill", label: "Skill", name: "skill-1" } as WorkflowNode["data"],
    });
    const targetSubWorkflow = makeSubWorkflowNode("target-sub", []);

    const result = moveNodeIntoSubWorkflowContext({
      nodes: [sourceNode, targetSubWorkflow],
      edges: [makeWorkflowEdge({ id: "edge-1", source: "skill-1", target: "target-sub" })],
      sourceNodeId: "skill-1",
      targetSubWorkflowNodeId: "target-sub",
    });

    expect(result.moved).toBe(true);
    expect(result.edges).toEqual([]);

    const updatedTarget = result.nodes.find((node) => node.id === "target-sub");
    const subNodes = (updatedTarget?.data as Extract<WorkflowNode["data"], { type: WorkflowNodeType.SubWorkflow }>).subNodes;

    expect(subNodes.map((node) => node.data.type)).toEqual([
      WorkflowNodeType.Start,
      WorkflowNodeType.End,
      WorkflowNodeType.Skill,
    ]);
    expect(subNodes[2].position).toEqual({ x: 340, y: 200 });
    expect(subNodes[2].data.name).toBe("skill-1");
  });

  it("refuses to move a sub-workflow into one of its descendants", () => {
    const nestedTarget = makeSubWorkflowNode("target", []);
    const sourceSubWorkflow = makeSubWorkflowNode("source", [nestedTarget]);

    const result = moveNodeIntoSubWorkflowContext({
      nodes: [sourceSubWorkflow, nestedTarget],
      edges: [],
      sourceNodeId: "source",
      targetSubWorkflowNodeId: "target",
    });

    expect(result.moved).toBe(false);
    expect(result.nodes).toEqual([sourceSubWorkflow, nestedTarget]);
  });

  it("refuses to move a start node into a sub-workflow", () => {
    const startNode = makeWorkflowNode({
      id: "start-1",
      type: WorkflowNodeType.Start,
      data: { type: WorkflowNodeType.Start, label: "Start", name: "start-1" } as WorkflowNode["data"],
    });
    const targetSubWorkflow = makeSubWorkflowNode("target-sub", []);

    const result = moveNodeIntoSubWorkflowContext({
      nodes: [startNode, targetSubWorkflow],
      edges: [],
      sourceNodeId: "start-1",
      targetSubWorkflowNodeId: "target-sub",
    });

    expect(result.moved).toBe(false);
    expect(result.nodes).toEqual([startNode, targetSubWorkflow]);
  });
});


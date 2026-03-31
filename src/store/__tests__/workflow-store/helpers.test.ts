import { describe, expect, it } from "bun:test";
import { SubAgentMemory, SubAgentModel } from "@/nodes/agent/enums";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflow";
import {
  buildWorkflowJson,
  createDefaultEndNode,
  createDefaultStartNode,
  deriveSaveStatus,
  ensureEndNode,
  ensureStartNode,
  migrateLegacyPromptScripts,
  stripLegacySkillProjectName,
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

function makeEdge(overrides: Partial<WorkflowEdge>): WorkflowEdge {
  return {
    id: overrides.id ?? "edge-1",
    source: overrides.source ?? "a",
    target: overrides.target ?? "b",
    type: overrides.type ?? "deletable",
    ...overrides,
  } as WorkflowEdge;
}

describe("workflow-store-helpers", () => {
  it("derives dirty and save status correctly", () => {
    expect(deriveSaveStatus("current", "baseline", null, "pristine")).toEqual({
      isDirty: true,
      needsSave: true,
    });

    expect(deriveSaveStatus("saved", "saved", null, "pristine")).toEqual({
      isDirty: false,
      needsSave: true,
    });

    expect(deriveSaveStatus("pristine", "pristine", null, "pristine")).toEqual({
      isDirty: false,
      needsSave: false,
    });
  });

  it("ensures start and end nodes exist without duplicating existing ones", () => {
    const promptNode = makeNode({
      id: "prompt-1",
      data: { type: "prompt", label: "Prompt", name: "prompt-1" } as WorkflowNode["data"],
    });

    const withStart = ensureStartNode([promptNode]);
    expect(withStart[0].data.type).toBe("start");
    expect(withStart).toHaveLength(2);

    const existingStart = createDefaultStartNode();
    const sameStartArray = [existingStart, promptNode];
    expect(ensureStartNode(sameStartArray)).toBe(sameStartArray);

    const withEnd = ensureEndNode([promptNode]);
    expect(withEnd.at(-1)?.data.type).toBe("end");
    expect(withEnd).toHaveLength(2);

    const existingEnd = createDefaultEndNode();
    const sameEndArray = [promptNode, existingEnd];
    expect(ensureEndNode(sameEndArray)).toBe(sameEndArray);
  });

  it("migrates legacy prompt-to-script attachments, including nested sub-workflows", () => {
    const legacyPrompt = makeNode({
      id: "prompt-script",
      type: "prompt",
      data: {
        type: "prompt",
        label: "Legacy Script",
        name: "prompt-script",
        promptText: "console.log('hi')",
      } as WorkflowNode["data"],
    });
    const skillNode = makeNode({
      id: "skill-1",
      type: "skill",
      data: { type: "skill", label: "Skill", name: "skill-1" } as WorkflowNode["data"],
    });
    const subPrompt = makeNode({
      id: "sub-prompt",
      type: "prompt",
      data: {
        type: "prompt",
        label: "Nested Legacy Script",
        name: "sub-prompt",
      } as WorkflowNode["data"],
    });
    const subWorkflow = makeNode({
      id: "sub-1",
      type: "sub-workflow",
      data: {
        type: "sub-workflow",
        label: "Nested",
        name: "sub-1",
        mode: "same-context",
        description: "",
        subNodes: [subPrompt],
        subEdges: [
          makeEdge({
            id: "sub-edge",
            source: "sub-prompt",
            target: "skill-2",
            targetHandle: "scripts",
          }),
        ],
        nodeCount: 1,
        model: SubAgentModel.Inherit,
        memory: SubAgentMemory.Default,
        temperature: 0,
        color: "#000000",
        disabledTools: [],
      } as WorkflowNode["data"],
    });

    const { nodes, edges } = migrateLegacyPromptScripts(
      [legacyPrompt, skillNode, subWorkflow],
      [makeEdge({ id: "edge-1", source: "prompt-script", target: "skill-1", targetHandle: "scripts" })],
    );

    expect(nodes[0].type).toBe("script");
    expect(nodes[0].data.type).toBe("script");
    expect(edges[0].sourceHandle).toBe("script-out");

    const nested = nodes[2].data as Extract<WorkflowNode["data"], { type: "sub-workflow" }>;
    expect(nested.subNodes[0].type).toBe("script");
    expect(nested.subEdges[0].sourceHandle).toBe("script-out");
  });

  it("removes legacy skill projectName fields recursively", () => {
    const skillNode = makeNode({
      id: "skill-1",
      type: "skill",
      data: {
        type: "skill",
        label: "Skill",
        name: "skill-1",
        skillName: "skill-one",
        projectName: "legacy-project",
      } as WorkflowNode["data"] & { projectName: string },
    });
    const nestedSkill = makeNode({
      id: "nested-skill",
      type: "skill",
      data: {
        type: "skill",
        label: "Nested Skill",
        name: "nested-skill",
        projectName: "old-project",
      } as WorkflowNode["data"] & { projectName: string },
    });
    const subWorkflow = makeNode({
      id: "sub-1",
      type: "sub-workflow",
      data: {
        type: "sub-workflow",
        label: "Nested",
        name: "sub-1",
        mode: "same-context",
        description: "",
        subNodes: [nestedSkill],
        subEdges: [],
        nodeCount: 1,
        model: SubAgentModel.Inherit,
        memory: SubAgentMemory.Default,
        temperature: 0,
        color: "#000000",
        disabledTools: [],
      } as WorkflowNode["data"],
    });

    const result = stripLegacySkillProjectName([skillNode, subWorkflow]);
    expect(result[0].data).not.toHaveProperty("projectName");
    const nested = result[1].data as Extract<WorkflowNode["data"], { type: "sub-workflow" }>;
    expect(nested.subNodes[0].data).not.toHaveProperty("projectName");
  });

  it("builds workflow JSON and strips transient node and edge properties", () => {
    const json = buildWorkflowJson({
      name: "Workflow",
      nodes: [
        makeNode({
          id: "prompt-1",
          selected: true,
          dragging: true,
          deletable: true,
          data: {
            type: "prompt",
            label: "Prompt",
            name: "prompt-1",
            promptText: "hello",
          } as WorkflowNode["data"],
        }),
      ],
      edges: [
        makeEdge({
          id: "edge-1",
          source: "prompt-1",
          target: "end-1",
          selected: true,
          animated: true,
          style: { stroke: "red" },
        }),
      ],
      sidebarOpen: false,
      minimapVisible: true,
      viewport: { x: 10, y: 20, zoom: 1.25 },
      canvasMode: "selection",
      edgeStyle: "smoothstep",
    });

    expect(json.ui.canvasMode).toBe("selection");
    expect(json.ui.edgeStyle).toBe("smoothstep");
    expect(json.nodes[0]).not.toHaveProperty("selected");
    expect(json.nodes[0]).not.toHaveProperty("dragging");
    expect(json.edges[0]).not.toHaveProperty("animated");
    expect(json.edges[0]).not.toHaveProperty("style");
  });
});



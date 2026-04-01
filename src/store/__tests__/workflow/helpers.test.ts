import { describe, expect, it } from "bun:test";
import { SubAgentMemory, SubAgentModel } from "@/nodes/agent/enums";
import { WorkflowNodeType, type WorkflowNode } from "@/types/workflow";
import { makeWorkflowEdge, makeWorkflowNode } from "@/test-support/workflow-fixtures";
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

describe("workflow helpers", () => {
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
    const promptNode = makeWorkflowNode({
      id: "prompt-1",
      data: { type: WorkflowNodeType.Prompt, label: "Prompt", name: "prompt-1" } as WorkflowNode["data"],
    });

    const withStart = ensureStartNode([promptNode]);
    expect(withStart[0].data.type).toBe(WorkflowNodeType.Start);
    expect(withStart).toHaveLength(2);

    const existingStart = createDefaultStartNode();
    const sameStartArray = [existingStart, promptNode];
    expect(ensureStartNode(sameStartArray)).toBe(sameStartArray);

    const withEnd = ensureEndNode([promptNode]);
    expect(withEnd.at(-1)?.data.type).toBe(WorkflowNodeType.End);
    expect(withEnd).toHaveLength(2);

    const existingEnd = createDefaultEndNode();
    const sameEndArray = [promptNode, existingEnd];
    expect(ensureEndNode(sameEndArray)).toBe(sameEndArray);
  });

  it("migrates legacy prompt-to-script attachments, including nested sub-workflows", () => {
    const legacyPrompt = makeWorkflowNode({
      id: "prompt-script",
      type: WorkflowNodeType.Prompt,
      data: {
        type: WorkflowNodeType.Prompt,
        label: "Legacy Script",
        name: "prompt-script",
        promptText: "console.log('hi')",
      } as WorkflowNode["data"],
    });
    const skillNode = makeWorkflowNode({
      id: "skill-1",
      type: WorkflowNodeType.Skill,
      data: { type: WorkflowNodeType.Skill, label: "Skill", name: "skill-1" } as WorkflowNode["data"],
    });
    const subPrompt = makeWorkflowNode({
      id: "sub-prompt",
      type: WorkflowNodeType.Prompt,
      data: {
        type: WorkflowNodeType.Prompt,
        label: "Nested Legacy Script",
        name: "sub-prompt",
      } as WorkflowNode["data"],
    });
    const subWorkflow = makeWorkflowNode({
      id: "sub-1",
      type: WorkflowNodeType.SubWorkflow,
      data: {
        type: WorkflowNodeType.SubWorkflow,
        label: "Nested",
        name: "sub-1",
        mode: "same-context",
        description: "",
        subNodes: [subPrompt],
        subEdges: [
          makeWorkflowEdge({
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
      [makeWorkflowEdge({ id: "edge-1", source: "prompt-script", target: "skill-1", targetHandle: "scripts" })],
    );

    expect(nodes[0].type).toBe(WorkflowNodeType.Script);
    expect(nodes[0].data.type).toBe(WorkflowNodeType.Script);
    expect(edges[0].sourceHandle).toBe("script-out");

    const nested = nodes[2].data as Extract<WorkflowNode["data"], { type: WorkflowNodeType.SubWorkflow }>;
    expect(nested.subNodes[0].type).toBe(WorkflowNodeType.Script);
    expect(nested.subEdges[0].sourceHandle).toBe("script-out");
  });

  it("removes legacy skill projectName fields recursively", () => {
    const skillNode = makeWorkflowNode({
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
    const nestedSkill = makeWorkflowNode({
      id: "nested-skill",
      type: "skill",
      data: {
        type: "skill",
        label: "Nested Skill",
        name: "nested-skill",
        projectName: "old-project",
      } as WorkflowNode["data"] & { projectName: string },
    });
    const subWorkflow = makeWorkflowNode({
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
        makeWorkflowNode({
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
        makeWorkflowEdge({
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




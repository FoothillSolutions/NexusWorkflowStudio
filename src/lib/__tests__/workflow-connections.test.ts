import { describe, expect, it } from "bun:test";
import type { Connection, Edge } from "@xyflow/react";
import { SubAgentMemory } from "@/nodes/agent/enums";
import { makeWorkflowEdge, makeWorkflowNode } from "@/test-support/workflow-fixtures";
import { WorkflowNodeType, type WorkflowNode } from "@/types/workflow";
import {
  DOCUMENT_TARGET_HANDLE,
  SCRIPT_SOURCE_HANDLE,
  SCRIPT_TARGET_HANDLE,
  SKILL_TARGET_HANDLE,
  normalizeWorkflowConnection,
} from "../workflow-connections";

function connect(
  connection: Partial<Connection>,
  nodes: WorkflowNode[],
  edges: Edge[] = [],
) {
  return normalizeWorkflowConnection({
    connection: connection as Connection,
    nodes,
    edges,
  });
}

describe("workflow connections", () => {
  it("normalizes script connections to the script attachment handles", () => {
    const nodes = [
      makeWorkflowNode({
        id: "script-1",
        type: WorkflowNodeType.Script,
        data: { type: WorkflowNodeType.Script, label: "Script", name: "script-1", promptText: "", detectedVariables: [] },
      }),
      makeWorkflowNode({
        id: "skill-1",
        type: WorkflowNodeType.Skill,
        data: { type: WorkflowNodeType.Skill, label: "Skill", name: "skill-1", skillName: "", description: "", promptText: "", detectedVariables: [], variableMappings: {}, metadata: [] },
      }),
    ];

    const next = connect({ source: "script-1", target: "skill-1" }, nodes);

    expect(next).toHaveLength(1);
    expect(next?.[0]).toMatchObject({
      sourceHandle: SCRIPT_SOURCE_HANDLE,
      targetHandle: SCRIPT_TARGET_HANDLE,
    });
  });

  it("normalizes skill and document connections to agent-like handles", () => {
    const agent = makeWorkflowNode({
      id: "agent-1",
      type: WorkflowNodeType.Agent,
      data: {
        type: WorkflowNodeType.Agent,
        label: "Agent",
        name: "agent-1",
        description: "",
        promptText: "",
        detectedVariables: [],
        model: "",
        memory: SubAgentMemory.Default,
        temperature: 0,
        color: "#000000",
        disabledTools: [],
        parameterMappings: [],
        variableMappings: {},
      } as WorkflowNode["data"],
    });
    const skill = makeWorkflowNode({
      id: "skill-1",
      type: WorkflowNodeType.Skill,
      data: { type: WorkflowNodeType.Skill, label: "Skill", name: "skill-1", skillName: "", description: "", promptText: "", detectedVariables: [], variableMappings: {}, metadata: [] },
    });
    const document = makeWorkflowNode({
      id: "doc-1",
      type: WorkflowNodeType.Document,
      data: {
        type: WorkflowNodeType.Document,
        label: "Document",
        name: "doc-1",
        docName: "guide",
        docSubfolder: "",
        contentMode: "inline",
        fileExtension: "md",
        contentText: "",
        linkedFileName: "",
        linkedFileContent: "",
        description: "",
      },
    });

    const skillEdges = connect({ source: "skill-1", target: "agent-1" }, [skill, agent]);
    const docEdges = connect({ source: "doc-1", target: "agent-1" }, [document, agent]);

    expect(skillEdges?.[0].targetHandle).toBe(SKILL_TARGET_HANDLE);
    expect(docEdges?.[0].targetHandle).toBe(DOCUMENT_TARGET_HANDLE);
  });

  it("blocks invalid target nodes and protected handles", () => {
    const prompt = makeWorkflowNode({
      id: "prompt-1",
      type: WorkflowNodeType.Prompt,
      data: { type: WorkflowNodeType.Prompt, label: "Prompt", name: "prompt-1", promptText: "", detectedVariables: [] },
    });
    const skill = makeWorkflowNode({
      id: "skill-1",
      type: WorkflowNodeType.Skill,
      data: { type: WorkflowNodeType.Skill, label: "Skill", name: "skill-1", skillName: "", description: "", promptText: "", detectedVariables: [], variableMappings: {}, metadata: [] },
    });
    const document = makeWorkflowNode({
      id: "doc-1",
      type: WorkflowNodeType.Document,
      data: {
        type: WorkflowNodeType.Document,
        label: "Document",
        name: "doc-1",
        docName: "guide",
        docSubfolder: "",
        contentMode: "inline",
        fileExtension: "md",
        contentText: "",
        linkedFileName: "",
        linkedFileContent: "",
        description: "",
      },
    });

    expect(connect({ source: "prompt-1", target: "skill-1" }, [prompt, skill])).toBeNull();
    expect(connect({ source: "prompt-1", target: "doc-1" }, [prompt, document])).toBeNull();
    expect(
      connect({ source: "prompt-1", target: "x", targetHandle: SKILL_TARGET_HANDLE }, [prompt]),
    ).toBeNull();
  });

  it("keeps only one edge per source handle for general connections", () => {
    const prompt = makeWorkflowNode({
      id: "prompt-1",
      type: WorkflowNodeType.Prompt,
      data: { type: WorkflowNodeType.Prompt, label: "Prompt", name: "prompt-1", promptText: "", detectedVariables: [] },
    });
    const endA = makeWorkflowNode({
      id: "end-a",
      type: WorkflowNodeType.End,
      data: { type: WorkflowNodeType.End, label: "End A", name: "end-a" },
    });
    const endB = makeWorkflowNode({
      id: "end-b",
      type: WorkflowNodeType.End,
      data: { type: WorkflowNodeType.End, label: "End B", name: "end-b" },
    });

    const next = connect(
      { source: "prompt-1", target: "end-b", sourceHandle: "output" },
      [prompt, endA, endB],
      [makeWorkflowEdge({ id: "edge-1", source: "prompt-1", target: "end-a", sourceHandle: "output" })],
    );

    expect(next).toHaveLength(1);
    expect(next?.[0]).toMatchObject({ target: "end-b", sourceHandle: "output" });
  });

  it("only allows parallel-agent branch handles to target agent nodes", () => {
    const parallelAgent = makeWorkflowNode({
      id: "parallel-1",
      type: WorkflowNodeType.ParallelAgent,
      data: { type: WorkflowNodeType.ParallelAgent, label: "Parallel", name: "parallel-1", sharedInstructions: "", branches: [] },
    });
    const agent = makeWorkflowNode({
      id: "agent-1",
      type: WorkflowNodeType.Agent,
      data: {
        type: WorkflowNodeType.Agent,
        label: "Agent",
        name: "agent-1",
        description: "",
        promptText: "",
        detectedVariables: [],
        model: "",
        memory: SubAgentMemory.Default,
        temperature: 0,
        color: "#000000",
        disabledTools: [],
        parameterMappings: [],
        variableMappings: {},
      } as WorkflowNode["data"],
    });
    const skill = makeWorkflowNode({
      id: "skill-1",
      type: WorkflowNodeType.Skill,
      data: { type: WorkflowNodeType.Skill, label: "Skill", name: "skill-1", skillName: "", description: "", promptText: "", detectedVariables: [], variableMappings: {}, metadata: [] },
    });

    expect(
      connect({ source: "parallel-1", target: "skill-1", sourceHandle: "branch-0" }, [parallelAgent, skill]),
    ).toBeNull();
    expect(
      connect({ source: "parallel-1", target: "agent-1", sourceHandle: "branch-0" }, [parallelAgent, agent]),
    ).toHaveLength(1);
  });
});


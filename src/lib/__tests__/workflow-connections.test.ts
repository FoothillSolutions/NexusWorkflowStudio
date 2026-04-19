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
import { createSwitchBranch } from "@/nodes/switch/branches";

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
        linkedFileName: null,
        linkedFileContent: null,
        description: "",
        brainDocId: null,
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
      data: { type: WorkflowNodeType.Prompt, label: "Prompt", name: "prompt-1", promptText: "", detectedVariables: [], brainDocId: null },
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
        linkedFileName: null,
        linkedFileContent: null,
        description: "",
        brainDocId: null,
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
      data: { type: WorkflowNodeType.Prompt, label: "Prompt", name: "prompt-1", promptText: "", detectedVariables: [], brainDocId: null },
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
      data: {
        type: WorkflowNodeType.ParallelAgent,
        label: "Parallel",
        name: "parallel-1",
        spawnMode: "fixed",
        sharedInstructions: "",
        branches: [],
        spawnCriterion: "",
        spawnMin: 1,
        spawnMax: 1,
      } as WorkflowNode["data"],
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

  it("dynamic-mode parallel-agent canonicalizes sourceHandle to 'output' when connecting to an agent", () => {
    const parallelAgent = makeWorkflowNode({
      id: "parallel-d",
      type: WorkflowNodeType.ParallelAgent,
      data: {
        type: WorkflowNodeType.ParallelAgent,
        label: "Parallel Dyn",
        name: "parallel-d",
        spawnMode: "dynamic",
        sharedInstructions: "",
        branches: [],
        spawnCriterion: "per item",
        spawnMin: 1,
        spawnMax: 3,
      } as WorkflowNode["data"],
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

    const edges = connect(
      { source: "parallel-d", target: "agent-1", sourceHandle: "output" },
      [parallelAgent, agent],
    );
    expect(edges).toHaveLength(1);
    expect(edges?.[0].sourceHandle).toBe("output");
  });

  it("dynamic-mode parallel-agent rejects branch-N sourceHandles", () => {
    const parallelAgent = makeWorkflowNode({
      id: "parallel-d",
      type: WorkflowNodeType.ParallelAgent,
      data: {
        type: WorkflowNodeType.ParallelAgent,
        label: "Parallel Dyn",
        name: "parallel-d",
        spawnMode: "dynamic",
        sharedInstructions: "",
        branches: [],
        spawnCriterion: "per item",
        spawnMin: 1,
        spawnMax: 3,
      } as WorkflowNode["data"],
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

    expect(
      connect({ source: "parallel-d", target: "agent-1", sourceHandle: "branch-0" }, [parallelAgent, agent]),
    ).toBeNull();
  });

  it("dynamic-mode parallel-agent rejects non-Agent targets", () => {
    const parallelAgent = makeWorkflowNode({
      id: "parallel-d",
      type: WorkflowNodeType.ParallelAgent,
      data: {
        type: WorkflowNodeType.ParallelAgent,
        label: "Parallel Dyn",
        name: "parallel-d",
        spawnMode: "dynamic",
        sharedInstructions: "",
        branches: [],
        spawnCriterion: "per item",
        spawnMin: 1,
        spawnMax: 3,
      } as WorkflowNode["data"],
    });
    const endNode = makeWorkflowNode({
      id: "end-1",
      type: WorkflowNodeType.End,
      data: { type: WorkflowNodeType.End, label: "End", name: "end-1" },
    });

    expect(
      connect({ source: "parallel-d", target: "end-1", sourceHandle: "output" }, [parallelAgent, endNode]),
    ).toBeNull();
  });

  it("dynamic-mode parallel-agent only keeps one outgoing output edge (existing filteredEdges behavior)", () => {
    const parallelAgent = makeWorkflowNode({
      id: "parallel-d",
      type: WorkflowNodeType.ParallelAgent,
      data: {
        type: WorkflowNodeType.ParallelAgent,
        label: "Parallel Dyn",
        name: "parallel-d",
        spawnMode: "dynamic",
        sharedInstructions: "",
        branches: [],
        spawnCriterion: "per item",
        spawnMin: 1,
        spawnMax: 3,
      } as WorkflowNode["data"],
    });
    const agentA = makeWorkflowNode({
      id: "agent-a",
      type: WorkflowNodeType.Agent,
      data: {
        type: WorkflowNodeType.Agent,
        label: "Agent A",
        name: "agent-a",
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
    const agentB = makeWorkflowNode({
      id: "agent-b",
      type: WorkflowNodeType.Agent,
      data: {
        type: WorkflowNodeType.Agent,
        label: "Agent B",
        name: "agent-b",
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

    const edges = connect(
      { source: "parallel-d", target: "agent-b", sourceHandle: "output" },
      [parallelAgent, agentA, agentB],
      [makeWorkflowEdge({ id: "e-prior", source: "parallel-d", target: "agent-a", sourceHandle: "output" })],
    );
    expect(edges).toHaveLength(1);
    expect(edges?.[0]).toMatchObject({ target: "agent-b", sourceHandle: "output" });
  });

  it("allows an agent → handoff flow edge with the default output/input handles", () => {
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
    const handoff = makeWorkflowNode({
      id: "handoff-1",
      type: WorkflowNodeType.Handoff,
      data: {
        type: WorkflowNodeType.Handoff,
        label: "Handoff",
        name: "handoff-1",
        mode: "file",
        fileName: "",
        payloadStyle: "structured",
        payloadSections: ["summary"],
        payloadPrompt: "",
        notes: "",
      } as WorkflowNode["data"],
    });

    const next = connect(
      { source: "agent-1", target: "handoff-1", sourceHandle: "output", targetHandle: "input" },
      [agent, handoff],
    );
    expect(next).toHaveLength(1);
    expect(next?.[0]).toMatchObject({ sourceHandle: "output", targetHandle: "input" });
  });

  it("allows a prompt → handoff flow edge", () => {
    const prompt = makeWorkflowNode({
      id: "prompt-1",
      type: WorkflowNodeType.Prompt,
      data: { type: WorkflowNodeType.Prompt, label: "Prompt", name: "prompt-1", promptText: "", detectedVariables: [], brainDocId: null },
    });
    const handoff = makeWorkflowNode({
      id: "handoff-1",
      type: WorkflowNodeType.Handoff,
      data: {
        type: WorkflowNodeType.Handoff,
        label: "Handoff",
        name: "handoff-1",
        mode: "file",
        fileName: "",
        payloadStyle: "structured",
        payloadSections: [],
        payloadPrompt: "",
        notes: "",
      } as WorkflowNode["data"],
    });

    const next = connect(
      { source: "prompt-1", target: "handoff-1", sourceHandle: "output", targetHandle: "input" },
      [prompt, handoff],
    );
    expect(next).toHaveLength(1);
  });

  it("allows a handoff → agent flow edge with the default output/input handles", () => {
    const handoff = makeWorkflowNode({
      id: "handoff-1",
      type: WorkflowNodeType.Handoff,
      data: {
        type: WorkflowNodeType.Handoff,
        label: "Handoff",
        name: "handoff-1",
        mode: "file",
        fileName: "",
        payloadStyle: "structured",
        payloadSections: [],
        payloadPrompt: "",
        notes: "",
      } as WorkflowNode["data"],
    });
    const agent = makeWorkflowNode({
      id: "agent-2",
      type: WorkflowNodeType.Agent,
      data: {
        type: WorkflowNodeType.Agent,
        label: "Agent",
        name: "agent-2",
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

    const next = connect(
      { source: "handoff-1", target: "agent-2", sourceHandle: "output", targetHandle: "input" },
      [handoff, agent],
    );
    expect(next).toHaveLength(1);
    expect(next?.[0]).toMatchObject({ sourceHandle: "output", targetHandle: "input" });
  });

  it("allows a handoff → end flow edge", () => {
    const handoff = makeWorkflowNode({
      id: "handoff-1",
      type: WorkflowNodeType.Handoff,
      data: {
        type: WorkflowNodeType.Handoff,
        label: "Handoff",
        name: "handoff-1",
        mode: "context",
        fileName: "",
        payloadStyle: "structured",
        payloadSections: [],
        payloadPrompt: "",
        notes: "",
      } as WorkflowNode["data"],
    });
    const endNode = makeWorkflowNode({
      id: "end-1",
      type: WorkflowNodeType.End,
      data: { type: WorkflowNodeType.End, label: "End", name: "end-1" },
    });

    const next = connect(
      { source: "handoff-1", target: "end-1", sourceHandle: "output", targetHandle: "input" },
      [handoff, endNode],
    );
    expect(next).toHaveLength(1);
  });

  it("rejects skill → handoff and document → handoff connections", () => {
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
        linkedFileName: null,
        linkedFileContent: null,
        description: "",
        brainDocId: null,
      },
    });
    const handoff = makeWorkflowNode({
      id: "handoff-1",
      type: WorkflowNodeType.Handoff,
      data: {
        type: WorkflowNodeType.Handoff,
        label: "Handoff",
        name: "handoff-1",
        mode: "file",
        fileName: "",
        payloadStyle: "structured",
        payloadSections: [],
        payloadPrompt: "",
        notes: "",
      } as WorkflowNode["data"],
    });

    expect(connect({ source: "skill-1", target: "handoff-1" }, [skill, handoff])).toBeNull();
    expect(connect({ source: "doc-1", target: "handoff-1" }, [document, handoff])).toBeNull();
  });

  it("rejects handoff → skill and handoff → document connections", () => {
    const handoff = makeWorkflowNode({
      id: "handoff-1",
      type: WorkflowNodeType.Handoff,
      data: {
        type: WorkflowNodeType.Handoff,
        label: "Handoff",
        name: "handoff-1",
        mode: "file",
        fileName: "",
        payloadStyle: "structured",
        payloadSections: [],
        payloadPrompt: "",
        notes: "",
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
        linkedFileName: null,
        linkedFileContent: null,
        description: "",
        brainDocId: null,
      },
    });

    expect(connect({ source: "handoff-1", target: "skill-1" }, [handoff, skill])).toBeNull();
    expect(connect({ source: "handoff-1", target: "doc-1" }, [handoff, document])).toBeNull();
  });

  it("canonicalizes switch branch handles to the stable branch handle id", () => {
    const branches = [
      createSwitchBranch({ id: "switch-branch-case-1", label: "Pending", condition: "" }),
      createSwitchBranch({ id: "switch-branch-default", label: "default", condition: "Other cases" }),
    ];
    const switchNode = makeWorkflowNode({
      id: "switch-1",
      type: WorkflowNodeType.Switch,
      data: {
        type: WorkflowNodeType.Switch,
        label: "Switch",
        name: "switch-1",
        evaluationTarget: "status",
        branches,
      },
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
      { source: "switch-1", target: "end-b", sourceHandle: "Pending" },
      [switchNode, endA, endB],
      [makeWorkflowEdge({ id: "edge-1", source: "switch-1", target: "end-a", sourceHandle: "switch-branch-case-1" })],
    );

    expect(next).toHaveLength(1);
    expect(next?.[0]).toMatchObject({
      sourceHandle: "switch-branch-case-1",
      target: "end-b",
    });
  });
});


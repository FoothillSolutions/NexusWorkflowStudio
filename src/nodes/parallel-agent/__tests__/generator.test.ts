import { describe, expect, it } from "bun:test";
import { WorkflowNodeType, type ParallelAgentNodeData } from "@/types/workflow";
import { SubAgentMemory } from "@/nodes/agent/enums";
import { makeWorkflowEdge, makeWorkflowNode } from "@/test-support/workflow-fixtures";
import { generator as parallelAgentGen } from "../generator";
import { buildParallelAgentDetailsSection } from "@/lib/workflow-generation/detail-sections";
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";

function fixedData(overrides: Partial<ParallelAgentNodeData> = {}): ParallelAgentNodeData {
  return {
    type: WorkflowNodeType.ParallelAgent,
    label: "Parallel",
    name: "parallel-1",
    spawnMode: "fixed",
    sharedInstructions: "",
    branches: [
      { label: "Branch 1", instructions: "", spawnCount: 1 },
      { label: "Branch 2", instructions: "", spawnCount: 2 },
    ],
    spawnCriterion: "",
    spawnMin: 1,
    spawnMax: 1,
    ...overrides,
  };
}

function dynamicData(overrides: Partial<ParallelAgentNodeData> = {}): ParallelAgentNodeData {
  return {
    type: WorkflowNodeType.ParallelAgent,
    label: "Parallel",
    name: "parallel-d",
    spawnMode: "dynamic",
    sharedInstructions: "",
    branches: [],
    spawnCriterion: "per item",
    spawnMin: 1,
    spawnMax: 3,
    ...overrides,
  };
}

function makeAgent(id: string): WorkflowNode {
  return makeWorkflowNode({
    id,
    type: WorkflowNodeType.Agent,
    data: {
      type: WorkflowNodeType.Agent,
      label: "Template",
      name: id,
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
}

function makeSkill(id: string, skillName: string): WorkflowNode {
  return makeWorkflowNode({
    id,
    type: WorkflowNodeType.Skill,
    data: {
      type: WorkflowNodeType.Skill,
      label: skillName,
      name: id,
      skillName,
      description: "",
      promptText: "",
      detectedVariables: [],
      variableMappings: {},
      metadata: [],
    } as WorkflowNode["data"],
  });
}

function makeDoc(id: string, docName: string, docSubfolder = ""): WorkflowNode {
  return makeWorkflowNode({
    id,
    type: WorkflowNodeType.Document,
    data: {
      type: WorkflowNodeType.Document,
      label: docName,
      name: id,
      docName,
      docSubfolder,
      contentMode: "inline",
      fileExtension: "md",
      contentText: "",
      linkedFileName: null,
      linkedFileContent: null,
      description: "",
      brainDocId: null,
    } as WorkflowNode["data"],
  });
}

describe("parallel-agent generator — fixed mode", () => {
  it("produces byte-stable output without sharedInstructions", () => {
    const data = fixedData();
    const output = parallelAgentGen.getDetailsSection("parallel-1", data);
    const expected = [
      "#### parallel_1(Parallel Agent)",
      "",
      "**Parallel branches:**",
      "- **branch-0** (Branch 1) → dispatch the connected agent using the `Agent` tool x1",
      "- **branch-1** (Branch 2) → dispatch the connected agent using the `Agent` tool x2",
      "",
      "**Execution method**: For each branch, dispatch the connected agent using the `Agent` tool the configured number of times; run the branches in parallel. Follow the per-agent dispatch details under `## Agent Node Details`.",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("produces byte-stable output with sharedInstructions and per-branch instructions", () => {
    const data = fixedData({
      sharedInstructions: "Coordinate findings",
      branches: [
        { label: "Scan A", instructions: "Scan competitor A", spawnCount: 1 },
        { label: "Scan B", instructions: "", spawnCount: 3 },
      ],
    });
    const output = parallelAgentGen.getDetailsSection("parallel-1", data);
    const expected = [
      "#### parallel_1(Parallel Agent)",
      "",
      "**Shared instructions**: Coordinate findings",
      "",
      "**Parallel branches:**",
      "- **branch-0** (Scan A) → dispatch the connected agent using the `Agent` tool x1",
      "  - Notes: Scan competitor A",
      "- **branch-1** (Scan B) → dispatch the connected agent using the `Agent` tool x3",
      "",
      "**Execution method**: For each branch, dispatch the connected agent using the `Agent` tool the configured number of times; run the branches in parallel. Follow the per-agent dispatch details under `## Agent Node Details`.",
    ].join("\n");
    expect(output).toBe(expected);
  });
});

describe("buildParallelAgentDetailsSection — fixed mode byte-stable", () => {
  it("produces the same fixed-mode output via the library-level builder", () => {
    const parallelNode = makeWorkflowNode({
      id: "parallel-1",
      type: WorkflowNodeType.ParallelAgent,
      data: fixedData() as WorkflowNode["data"],
    });

    const output = buildParallelAgentDetailsSection([parallelNode], []);
    const expected = [
      "### Parallel Agent Node Details",
      "",
      "#### parallel_1(Parallel Agent)",
      "",
      "**Parallel branches:**",
      "- **branch-0** (Branch 1) → (no agent connected — wire this branch to an `agent` node)",
      "- **branch-1** (Branch 2) → (no agent connected — wire this branch to an `agent` node)",
      "",
      "**Execution method**: For each branch, dispatch the connected agent using the `Agent` tool the configured number of times; run the branches in parallel. Follow the per-agent dispatch details under `## Agent Node Details`.",
    ].join("\n");
    expect(output).toBe(expected);
  });
});

describe("buildParallelAgentDetailsSection — dynamic mode dispatch format", () => {
  it("Example A: 0 skills, 0 docs, opencode target", () => {
    const parallelNode = makeWorkflowNode({
      id: "parallel-abc",
      type: WorkflowNodeType.ParallelAgent,
      data: dynamicData({
        name: "parallel-abc",
        spawnMin: 1,
        spawnMax: 3,
        spawnCriterion: "one per detected topic",
        sharedInstructions: "",
      }) as WorkflowNode["data"],
    });
    const agentNode = makeAgent("agent-tmpl");
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({
        id: "e-parallel-agent",
        source: "parallel-abc",
        target: "agent-tmpl",
        sourceHandle: "output",
      }),
    ];

    const output = buildParallelAgentDetailsSection([parallelNode, agentNode], edges, "opencode");
    const expected = [
      "### Parallel Agent Node Details",
      "",
      "#### parallel_abc",
      "",
      "Spawn `agent-tmpl` between 1 and 3 times based on: one per detected topic. For each spawned instance, dispatch it as follows:",
      "",
      "#### agent-tmpl(Agent: agent-tmpl)",
      "",
      "Dispatch `agent-tmpl` using the `Agent` tool.",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("Example B: 1 skill, 0 docs, pi target, with sharedInstructions, min===max", () => {
    const parallelNode = makeWorkflowNode({
      id: "parallel-def",
      type: WorkflowNodeType.ParallelAgent,
      data: dynamicData({
        name: "parallel-def",
        spawnMin: 2,
        spawnMax: 2,
        spawnCriterion: "one per input item",
        sharedInstructions: "Process inputs in parallel",
      }) as WorkflowNode["data"],
    });
    const agentNode = makeAgent("agent-worker");
    const skillNode = makeSkill("skill-extract", "data-extract");
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({
        id: "e-parallel-agent",
        source: "parallel-def",
        target: "agent-worker",
        sourceHandle: "output",
      }),
      makeWorkflowEdge({
        id: "e-skill-agent",
        source: "skill-extract",
        target: "agent-worker",
        sourceHandle: "skill-out",
        targetHandle: "skills",
      }),
    ];

    const output = buildParallelAgentDetailsSection(
      [parallelNode, agentNode, skillNode],
      edges,
      "pi",
    );
    const expected = [
      "### Parallel Agent Node Details",
      "",
      "#### parallel_def",
      "",
      "**Shared instructions**: Process inputs in parallel",
      "",
      "Spawn `agent-worker` exactly 2 times based on: one per input item. For each spawned instance, dispatch it as follows:",
      "",
      "#### agent-worker(Agent: agent-worker)",
      "",
      "Dispatch `agent-worker` using the `Agent` tool with inputs:",
      "- `data-extract`: `.pi/skills/data-extract/SKILL.md`",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("Example C: 3 skills, 2 docs, claude-code target", () => {
    const parallelNode = makeWorkflowNode({
      id: "parallel-ghi",
      type: WorkflowNodeType.ParallelAgent,
      data: dynamicData({
        name: "parallel-ghi",
        spawnMin: 1,
        spawnMax: 5,
        spawnCriterion: "one per file in input",
        sharedInstructions: "Collate findings",
      }) as WorkflowNode["data"],
    });
    const agentNode = makeAgent("agent-analyze");
    const skillLint = makeSkill("skill-lint", "lint-check");
    const skillDoc = makeSkill("skill-doc", "doc-build");
    const skillTest = makeSkill("skill-test", "test-runner");
    const docApi = makeDoc("doc-api", "api-guide", "product");
    const docQuick = makeDoc("doc-quick", "quickstart", "onboarding");
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({
        id: "e-p-a",
        source: "parallel-ghi",
        target: "agent-analyze",
        sourceHandle: "output",
      }),
      makeWorkflowEdge({
        id: "e-sk-lint",
        source: "skill-lint",
        target: "agent-analyze",
        sourceHandle: "skill-out",
        targetHandle: "skills",
      }),
      makeWorkflowEdge({
        id: "e-sk-doc",
        source: "skill-doc",
        target: "agent-analyze",
        sourceHandle: "skill-out",
        targetHandle: "skills",
      }),
      makeWorkflowEdge({
        id: "e-sk-test",
        source: "skill-test",
        target: "agent-analyze",
        sourceHandle: "skill-out",
        targetHandle: "skills",
      }),
      makeWorkflowEdge({
        id: "e-doc-api",
        source: "doc-api",
        target: "agent-analyze",
        sourceHandle: "doc-out",
        targetHandle: "docs",
      }),
      makeWorkflowEdge({
        id: "e-doc-quick",
        source: "doc-quick",
        target: "agent-analyze",
        sourceHandle: "doc-out",
        targetHandle: "docs",
      }),
    ];

    const output = buildParallelAgentDetailsSection(
      [parallelNode, agentNode, skillLint, skillDoc, skillTest, docApi, docQuick],
      edges,
      "claude-code",
    );
    const expected = [
      "### Parallel Agent Node Details",
      "",
      "#### parallel_ghi",
      "",
      "**Shared instructions**: Collate findings",
      "",
      "Spawn `agent-analyze` between 1 and 5 times based on: one per file in input. For each spawned instance, dispatch it as follows:",
      "",
      "#### agent-analyze(Agent: agent-analyze)",
      "",
      "Dispatch `agent-analyze` using the `Agent` tool with inputs:",
      "- `lint-check`: `${CLAUDE_PLUGIN_ROOT}/skills/lint-check/SKILL.md`",
      "- `doc-build`: `${CLAUDE_PLUGIN_ROOT}/skills/doc-build/SKILL.md`",
      "- `test-runner`: `${CLAUDE_PLUGIN_ROOT}/skills/test-runner/SKILL.md`",
      "- `api-guide`: `${CLAUDE_PLUGIN_ROOT}/docs/product/api-guide.md`",
      "- `quickstart`: `${CLAUDE_PLUGIN_ROOT}/docs/onboarding/quickstart.md`",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("Example D: template agent not connected — placeholder and warning comment", () => {
    const parallelNode = makeWorkflowNode({
      id: "parallel-lost",
      type: WorkflowNodeType.ParallelAgent,
      data: dynamicData({
        name: "parallel-lost",
        spawnMin: 1,
        spawnMax: 1,
        spawnCriterion: "<criterion>",
        sharedInstructions: "",
      }) as WorkflowNode["data"],
    });

    const output = buildParallelAgentDetailsSection([parallelNode], [], "opencode");
    const expected = [
      "### Parallel Agent Node Details",
      "",
      "#### parallel_lost",
      "",
      "<!-- WARNING: no template agent connected to this parallel-agent node -->",
      "",
      "Spawn `<agent-not-connected>` exactly 1 times based on: <criterion>. For each spawned instance, dispatch it as follows:",
      "",
      "#### <agent-not-connected>(Agent: <agent-not-connected>)",
      "",
      "Dispatch `<agent-not-connected>` using the `Agent` tool.",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("dynamic-mode output contains no 'branch-' substring", () => {
    const parallelNode = makeWorkflowNode({
      id: "parallel-d",
      type: WorkflowNodeType.ParallelAgent,
      data: dynamicData({ spawnMin: 1, spawnMax: 3 }) as WorkflowNode["data"],
    });
    const agentNode = makeAgent("agent-tmpl");
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({
        id: "e-p-a",
        source: "parallel-d",
        target: "agent-tmpl",
        sourceHandle: "output",
      }),
    ];

    const output = buildParallelAgentDetailsSection([parallelNode, agentNode], edges, "opencode");
    expect(output.includes("branch-")).toBe(false);
  });
});

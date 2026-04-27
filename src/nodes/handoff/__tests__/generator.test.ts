import { describe, expect, it } from "bun:test";
import { SubAgentMemory } from "@/nodes/agent/enums";
import { makeWorkflowEdge, makeWorkflowNode } from "@/test-support/workflow-fixtures";
import { WorkflowNodeType, type HandoffNodeData, type WorkflowEdge, type WorkflowNode } from "@/types/workflow";
import { buildHandoffDetailsSection } from "@/lib/workflow-generation/detail-sections";
import { generateWorkflowFiles } from "@/lib/workflow-generator";
import {
  buildHandoffPayloadTemplate,
  generator as handoffGen,
  resolveHandoffFilePath,
} from "../generator";

function handoffData(overrides: Partial<HandoffNodeData> = {}): HandoffNodeData {
  return {
    type: WorkflowNodeType.Handoff,
    label: "Handoff",
    name: "handoff-xy",
    mode: "file",
    fileName: "",
    payloadStyle: "structured",
    payloadSections: ["summary", "artifacts", "nextSteps"],
    payloadPrompt: "",
    notes: "",
    ...overrides,
  };
}

function makeAgent(id: string): WorkflowNode {
  return makeWorkflowNode({
    id,
    type: WorkflowNodeType.Agent,
    data: {
      type: WorkflowNodeType.Agent,
      label: id,
      name: id,
      description: "",
      promptText: "do the thing",
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

function makeHandoff(id: string, overrides: Partial<HandoffNodeData> = {}): WorkflowNode {
  return makeWorkflowNode({
    id,
    type: WorkflowNodeType.Handoff,
    data: handoffData({ name: id, ...overrides }) as WorkflowNode["data"],
  });
}

describe("buildHandoffPayloadTemplate", () => {
  it("emits only the selected sections in canonical order (structured)", () => {
    const template = buildHandoffPayloadTemplate("handoff-xy", handoffData({
      payloadSections: ["nextSteps", "summary", "blockers"],
      notes: "",
    }));
    const expected = [
      "## Handoff Payload",
      "- **Summary:** <what you accomplished>",
      "- **Next steps:** <remaining work for the downstream agent>",
      "- **Blockers:** <issues that stopped progress>",
    ].join("\n");
    expect(template).toBe(expected);
  });

  it("appends notes at the end when non-empty (structured)", () => {
    const template = buildHandoffPayloadTemplate("handoff-xy", handoffData({
      payloadSections: ["summary"],
      notes: "Keep it short.",
    }));
    const expected = [
      "## Handoff Payload",
      "- **Summary:** <what you accomplished>",
      "",
      "Notes: Keep it short.",
    ].join("\n");
    expect(template).toBe(expected);
  });

  it("omits notes when blank (structured)", () => {
    const template = buildHandoffPayloadTemplate("handoff-xy", handoffData({
      payloadSections: ["summary"],
      notes: "   ",
    }));
    expect(template).toBe(["## Handoff Payload", "- **Summary:** <what you accomplished>"].join("\n"));
  });

  it("emits the payloadPrompt body in freeform style", () => {
    const template = buildHandoffPayloadTemplate("handoff-xy", handoffData({
      payloadStyle: "freeform",
      payloadSections: [],
      payloadPrompt: "Describe hypotheses explored and sources cited.",
      notes: "",
    }));
    const expected = [
      "## Handoff Payload",
      "Describe hypotheses explored and sources cited.",
    ].join("\n");
    expect(template).toBe(expected);
  });

  it("falls back to the placeholder when freeform payloadPrompt is blank", () => {
    const template = buildHandoffPayloadTemplate("handoff-xy", handoffData({
      payloadStyle: "freeform",
      payloadSections: [],
      payloadPrompt: "   ",
      notes: "",
    }));
    const expected = [
      "## Handoff Payload",
      "<describe what to hand off>",
    ].join("\n");
    expect(template).toBe(expected);
  });

  it("appends notes at the end in freeform style", () => {
    const template = buildHandoffPayloadTemplate("handoff-xy", handoffData({
      payloadStyle: "freeform",
      payloadSections: [],
      payloadPrompt: "Describe hypotheses explored.",
      notes: "Keep it short.",
    }));
    const expected = [
      "## Handoff Payload",
      "Describe hypotheses explored.",
      "",
      "Notes: Keep it short.",
    ].join("\n");
    expect(template).toBe(expected);
  });
});

describe("resolveHandoffFilePath", () => {
  it("uses the node id when fileName is blank", () => {
    expect(
      resolveHandoffFilePath("handoff-xy", handoffData({ fileName: "" })),
    ).toBe("./tmp/handoff-handoff-xy.json");
  });

  it("uses the fileName when provided", () => {
    expect(
      resolveHandoffFilePath("handoff-xy", handoffData({ fileName: "research-handoff" })),
    ).toBe("./tmp/handoff-research-handoff.json");
  });

  it("trims whitespace around fileName and falls back when empty", () => {
    expect(
      resolveHandoffFilePath("handoff-xy", handoffData({ fileName: "   " })),
    ).toBe("./tmp/handoff-handoff-xy.json");
  });
});

describe("handoff generator getDetailsSection", () => {
  it("produces byte-stable output for file mode (structured)", () => {
    const output = handoffGen.getDetailsSection("handoff-xy", handoffData({
      payloadSections: ["summary", "artifacts"],
      notes: "",
    }));
    const expected = [
      "#### handoff_xy(Handoff — file)",
      "",
      "- **Mode:** file",
      "- **File:** `./tmp/handoff-handoff-xy.json`",
      "- **Style:** structured",
      "- **Sections:** Summary, Artifacts",
      "",
      "**Handoff payload template:**",
      "```",
      "## Handoff Payload",
      "- **Summary:** <what you accomplished>",
      "- **Artifacts:** <files created or modified>",
      "```",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("produces byte-stable output for context mode (structured)", () => {
    const output = handoffGen.getDetailsSection("handoff-ab", handoffData({
      name: "handoff-ab",
      mode: "context",
      fileName: "",
      payloadSections: ["summary", "nextSteps"],
      notes: "Keep it short.",
    }));
    const expected = [
      "#### handoff_ab(Handoff — context)",
      "",
      "- **Mode:** context",
      "- **Style:** structured",
      "- **Sections:** Summary, Next steps",
      "",
      "**Handoff payload template:**",
      "```",
      "## Handoff Payload",
      "- **Summary:** <what you accomplished>",
      "- **Next steps:** <remaining work for the downstream agent>",
      "",
      "Notes: Keep it short.",
      "```",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("produces byte-stable output for file mode (freeform)", () => {
    const output = handoffGen.getDetailsSection("handoff-xy", handoffData({
      payloadStyle: "freeform",
      payloadSections: [],
      payloadPrompt: "Describe the hypotheses explored.",
      notes: "",
    }));
    const expected = [
      "#### handoff_xy(Handoff — file)",
      "",
      "- **Mode:** file",
      "- **File:** `./tmp/handoff-handoff-xy.json`",
      "- **Style:** freeform",
      "",
      "**Handoff payload template:**",
      "```",
      "## Handoff Payload",
      "Describe the hypotheses explored.",
      "```",
    ].join("\n");
    expect(output).toBe(expected);
  });
});

describe("buildHandoffDetailsSection", () => {
  it("Example A: file mode, agent-a → handoff → agent-b, opencode target", () => {
    const agentA = makeAgent("agent-a");
    const agentB = makeAgent("agent-b");
    const handoff = makeHandoff("handoff-xy", {
      mode: "file",
      payloadSections: ["summary", "artifacts", "nextSteps"],
    });
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({ id: "e-a-h", source: "agent-a", target: "handoff-xy", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-h-b", source: "handoff-xy", target: "agent-b", sourceHandle: "output", targetHandle: "input" }),
    ];

    const output = buildHandoffDetailsSection([agentA, handoff, agentB], edges, "opencode");
    const expected = [
      "### Handoff Node Details",
      "",
      "#### handoff-xy (Handoff — file)",
      "",
      "- Upstream agent `agent-a` MUST write the handoff payload to `./tmp/handoff-handoff-xy.json` before finishing.",
      "- Downstream agent `agent-b` MUST read `./tmp/handoff-handoff-xy.json` at startup before doing anything else.",
      "",
      "**Handoff payload template:**",
      "```",
      "## Handoff Payload",
      "- **Summary:** <what you accomplished>",
      "- **Artifacts:** <files created or modified>",
      "- **Next steps:** <remaining work for the downstream agent>",
      "```",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("Example B: context mode, agent-a → handoff → agent-b, pi target", () => {
    const agentA = makeAgent("agent-a");
    const agentB = makeAgent("agent-b");
    const handoff = makeHandoff("handoff-ab", {
      mode: "context",
      fileName: "",
      payloadSections: ["summary", "nextSteps"],
      notes: "Keep it short.",
    });
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({ id: "e-a-h", source: "agent-a", target: "handoff-ab", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-h-b", source: "handoff-ab", target: "agent-b", sourceHandle: "output", targetHandle: "input" }),
    ];

    const output = buildHandoffDetailsSection([agentA, handoff, agentB], edges, "pi");
    const expected = [
      "### Handoff Node Details",
      "",
      "#### handoff-ab (Handoff — context)",
      "",
      "- The handoff payload below is inlined directly into downstream agent `agent-b`'s system prompt. No file is written.",
      "",
      "**Handoff payload template:**",
      "```",
      "## Handoff Payload",
      "- **Summary:** <what you accomplished>",
      "- **Next steps:** <remaining work for the downstream agent>",
      "",
      "Notes: Keep it short.",
      "```",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("Example C: file mode, claude-code target, byte-stable", () => {
    const agentA = makeAgent("agent-a");
    const agentB = makeAgent("agent-b");
    const handoff = makeHandoff("handoff-cd", {
      mode: "file",
      payloadSections: ["summary", "artifacts"],
    });
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({ id: "e-a-h", source: "agent-a", target: "handoff-cd", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-h-b", source: "handoff-cd", target: "agent-b", sourceHandle: "output", targetHandle: "input" }),
    ];

    const output = buildHandoffDetailsSection([agentA, handoff, agentB], edges, "claude-code");
    const expected = [
      "### Handoff Node Details",
      "",
      "#### handoff-cd (Handoff — file)",
      "",
      "- Upstream agent `agent-a` MUST write the handoff payload to `./tmp/handoff-handoff-cd.json` before finishing.",
      "- Downstream agent `agent-b` MUST read `./tmp/handoff-handoff-cd.json` at startup before doing anything else.",
      "",
      "**Handoff payload template:**",
      "```",
      "## Handoff Payload",
      "- **Summary:** <what you accomplished>",
      "- **Artifacts:** <files created or modified>",
      "```",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("Example D: unconnected handoff emits a warning comment", () => {
    const handoff = makeHandoff("handoff-lone", {
      mode: "file",
      payloadSections: ["summary"],
    });

    const output = buildHandoffDetailsSection([handoff], [], "opencode");
    const expected = [
      "### Handoff Node Details",
      "",
      "#### handoff-lone (Handoff — file)",
      "",
      "<!-- WARNING: handoff handoff-lone is missing an upstream/downstream agent -->",
      "",
      "- Upstream agent `<upstream>` MUST write the handoff payload to `./tmp/handoff-handoff-lone.json` before finishing.",
      "- Downstream agent `<downstream>` MUST read `./tmp/handoff-handoff-lone.json` at startup before doing anything else.",
      "",
      "**Handoff payload template:**",
      "```",
      "## Handoff Payload",
      "- **Summary:** <what you accomplished>",
      "```",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("Example E: freeform file mode emits the freeform payload template", () => {
    const agentA = makeAgent("agent-a");
    const agentB = makeAgent("agent-b");
    const handoff = makeHandoff("handoff-fr", {
      mode: "file",
      payloadStyle: "freeform",
      payloadSections: [],
      payloadPrompt: "Describe the hypotheses explored and what's next.",
    });
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({ id: "e-a-h", source: "agent-a", target: "handoff-fr", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-h-b", source: "handoff-fr", target: "agent-b", sourceHandle: "output", targetHandle: "input" }),
    ];

    const output = buildHandoffDetailsSection([agentA, handoff, agentB], edges, "opencode");
    const expected = [
      "### Handoff Node Details",
      "",
      "#### handoff-fr (Handoff — file)",
      "",
      "- Upstream agent `agent-a` MUST write the handoff payload to `./tmp/handoff-handoff-fr.json` before finishing.",
      "- Downstream agent `agent-b` MUST read `./tmp/handoff-handoff-fr.json` at startup before doing anything else.",
      "",
      "**Handoff payload template:**",
      "```",
      "## Handoff Payload",
      "Describe the hypotheses explored and what's next.",
      "```",
    ].join("\n");
    expect(output).toBe(expected);
  });
});

describe("generateWorkflowFiles integration with handoff", () => {
  function buildStartEndWorkflow(handoffMode: "file" | "context") {
    const start = makeWorkflowNode({
      id: "start-1",
      type: WorkflowNodeType.Start,
      data: { type: WorkflowNodeType.Start, label: "Start", name: "start-1" } as WorkflowNode["data"],
    });
    const end = makeWorkflowNode({
      id: "end-1",
      type: WorkflowNodeType.End,
      data: { type: WorkflowNodeType.End, label: "End", name: "end-1" } as WorkflowNode["data"],
    });
    const agentA = makeAgent("agent-a");
    const agentB = makeAgent("agent-b");
    const handoff = makeHandoff("handoff-xy", {
      mode: handoffMode,
      fileName: "",
      payloadSections: ["summary", "nextSteps"],
    });
    const edges: WorkflowEdge[] = [
      makeWorkflowEdge({ id: "e-s-a", source: "start-1", target: "agent-a", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-a-h", source: "agent-a", target: "handoff-xy", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-h-b", source: "handoff-xy", target: "agent-b", sourceHandle: "output", targetHandle: "input" }),
      makeWorkflowEdge({ id: "e-b-e", source: "agent-b", target: "end-1", sourceHandle: "output", targetHandle: "input" }),
    ];
    return {
      name: "Handoff Flow",
      nodes: [start, agentA, handoff, agentB, end],
      edges,
      ui: { sidebarOpen: false, minimapVisible: false, viewport: { x: 0, y: 0, zoom: 1 } },
    };
  }

  it("emits a command file that includes the Handoff Node Details section (file mode)", () => {
    const workflow = buildStartEndWorkflow("file");
    const files = generateWorkflowFiles(workflow, "opencode");
    const commandFile = files.find((f) => f.path === ".opencode/commands/handoff-flow.md");
    expect(commandFile).toBeDefined();
    expect(commandFile?.content).toContain("### Handoff Node Details");
    expect(commandFile?.content).toContain("handoff-xy (Handoff — file)");
    expect(commandFile?.content).toContain("./tmp/handoff-handoff-xy.json");
  });

  it("embeds Outgoing Handoff in the upstream agent file in file mode", () => {
    const workflow = buildStartEndWorkflow("file");
    const files = generateWorkflowFiles(workflow, "opencode");
    const agentA = files.find((f) => f.path === ".opencode/agents/agent-a.md");
    expect(agentA).toBeDefined();
    expect(agentA?.content).toContain("## Outgoing Handoff");
    expect(agentA?.content).toContain("WRITE your handoff payload to `./tmp/handoff-handoff-xy.json`");
    expect(agentA?.content).toContain("downstream agent `agent-b`");
    expect(agentA?.content).not.toContain("## Startup Handoff");
  });

  it("embeds Startup Handoff in the downstream agent file in file mode", () => {
    const workflow = buildStartEndWorkflow("file");
    const files = generateWorkflowFiles(workflow, "opencode");
    const agentB = files.find((f) => f.path === ".opencode/agents/agent-b.md");
    expect(agentB).toBeDefined();
    expect(agentB?.content).toContain("## Startup Handoff");
    expect(agentB?.content).toContain("READ `./tmp/handoff-handoff-xy.json`");
    expect(agentB?.content).not.toContain("## Outgoing Handoff");
  });

  it("embeds context-mode Outgoing Handoff when mode is context", () => {
    const workflow = buildStartEndWorkflow("context");
    const files = generateWorkflowFiles(workflow, "opencode");
    const agentA = files.find((f) => f.path === ".opencode/agents/agent-a.md");
    expect(agentA).toBeDefined();
    expect(agentA?.content).toContain("## Outgoing Handoff");
    expect(agentA?.content).toContain(`Your final response MUST end with a section titled "Handoff Payload"`);
    expect(agentA?.content).not.toContain("WRITE your handoff payload");
  });

  it("embeds context-mode Startup Handoff when mode is context", () => {
    const workflow = buildStartEndWorkflow("context");
    const files = generateWorkflowFiles(workflow, "opencode");
    const agentB = files.find((f) => f.path === ".opencode/agents/agent-b.md");
    expect(agentB).toBeDefined();
    expect(agentB?.content).toContain("## Startup Handoff");
    expect(agentB?.content).toContain("prepended a Handoff Payload");
    expect(agentB?.content).not.toContain("READ `./tmp/");
  });
});

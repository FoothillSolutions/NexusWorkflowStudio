import { describe, expect, it } from "bun:test";
import { buildEditUserMessage } from "../../workflow-gen/edit-message";
import { WorkflowNodeType } from "@/types/workflow";
import type { WorkflowJSON } from "@/types/workflow";

function makeMinimalWorkflow(): WorkflowJSON {
  return {
    name: "Minimal",
    nodes: [
      {
        id: "start-a",
        type: "start",
        position: { x: 80, y: 300 },
        data: { type: WorkflowNodeType.Start, label: "Start", name: "start-a" },
      },
      {
        id: "agent-a",
        type: "agent",
        position: { x: 410, y: 300 },
        data: {
          type: WorkflowNodeType.Agent,
          label: "Reviewer",
          name: "agent-a",
          description: "",
          promptText: "Review code",
          detectedVariables: [],
          model: "inherit",
          memory: "session",
          temperature: 0.7,
          color: "violet",
          disabledTools: [],
          parameterMappings: [],
          variableMappings: {},
        },
      },
      {
        id: "end-a",
        type: "end",
        position: { x: 910, y: 300 },
        data: { type: WorkflowNodeType.End, label: "End", name: "end-a" },
      },
    ] as WorkflowJSON["nodes"],
    edges: [
      { id: "e-start-a-agent-a", source: "start-a", target: "agent-a" },
      { id: "e-agent-a-end-a", source: "agent-a", target: "end-a" },
    ] as WorkflowJSON["edges"],
    ui: {
      sidebarOpen: true,
      minimapVisible: true,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

describe("buildEditUserMessage", () => {
  it("includes the preserve-unchanged clause, JSON block, and trailing edit request", () => {
    const wf = makeMinimalWorkflow();
    const userPrompt = "Rename the reviewer agent to 'Senior Reviewer'";
    const msg = buildEditUserMessage(wf, userPrompt);

    expect(msg).toContain("Editing an existing workflow");
    expect(msg).toContain("Preserve IDs, positions");

    // Last non-empty line should be the edit request
    const lines = msg.split("\n").filter((l) => l.trim().length > 0);
    expect(lines[lines.length - 1]).toBe(`Edit request: ${userPrompt}`);

    // The fenced JSON block round-trips
    const match = msg.match(/```json\n([\s\S]*?)\n```/);
    expect(match).not.toBeNull();
    const roundTripped = JSON.parse(match![1]);
    expect(roundTripped).toEqual(wf);
  });

  it("still produces parseable JSON when the user prompt contains backticks", () => {
    const wf = makeMinimalWorkflow();
    const userPrompt = "Replace the prompt with ```special code block``` please";
    const msg = buildEditUserMessage(wf, userPrompt);

    const match = msg.match(/```json\n([\s\S]*?)\n```/);
    expect(match).not.toBeNull();
    const roundTripped = JSON.parse(match![1]);
    expect(roundTripped).toEqual(wf);

    // Prompt should still appear intact at the tail
    expect(msg.endsWith(`Edit request: ${userPrompt}`)).toBe(true);
  });
});

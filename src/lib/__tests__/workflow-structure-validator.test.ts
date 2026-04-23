import { describe, expect, it } from "bun:test";
import {
  summarizeStructuralIssues,
  validateWorkflowStructure,
} from "@/lib/workflow-structure-validator";
import { WorkflowNodeType, type WorkflowJSON } from "@/types/workflow";

function makeNode(id: string, type: WorkflowNodeType): WorkflowJSON["nodes"][number] {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { type, label: id, name: id } as never,
  } as WorkflowJSON["nodes"][number];
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  opts?: { sourceHandle?: string; targetHandle?: string },
): WorkflowJSON["edges"][number] {
  return {
    id,
    source,
    target,
    sourceHandle: opts?.sourceHandle,
    targetHandle: opts?.targetHandle,
  } as WorkflowJSON["edges"][number];
}

const baseUi: WorkflowJSON["ui"] = {
  sidebarOpen: true,
  minimapVisible: true,
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("validateWorkflowStructure", () => {
  it("accepts a straight start → agent → end workflow", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [
        makeNode("start-1", WorkflowNodeType.Start),
        makeNode("agent-1", WorkflowNodeType.Agent),
        makeNode("end-1", WorkflowNodeType.End),
      ],
      edges: [
        makeEdge("e1", "start-1", "agent-1"),
        makeEdge("e2", "agent-1", "end-1"),
      ],
      ui: baseUi,
    };
    expect(validateWorkflowStructure(wf)).toEqual([]);
  });

  it("flags missing start", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [makeNode("end-1", WorkflowNodeType.End)],
      edges: [],
      ui: baseUi,
    };
    const issues = validateWorkflowStructure(wf);
    expect(issues.some((i) => i.code === "missing-start")).toBe(true);
  });

  it("flags missing end", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [makeNode("start-1", WorkflowNodeType.Start)],
      edges: [],
      ui: baseUi,
    };
    const issues = validateWorkflowStructure(wf);
    expect(issues.some((i) => i.code === "missing-end")).toBe(true);
  });

  it("flags multiple start nodes", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [
        makeNode("start-1", WorkflowNodeType.Start),
        makeNode("start-2", WorkflowNodeType.Start),
        makeNode("end-1", WorkflowNodeType.End),
      ],
      edges: [],
      ui: baseUi,
    };
    const issues = validateWorkflowStructure(wf);
    expect(issues.some((i) => i.code === "multiple-start")).toBe(true);
  });

  it("flags no path from start to end", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [
        makeNode("start-1", WorkflowNodeType.Start),
        makeNode("agent-1", WorkflowNodeType.Agent),
        makeNode("end-1", WorkflowNodeType.End),
      ],
      // agent is dangling, end is unreachable
      edges: [makeEdge("e1", "start-1", "agent-1")],
      ui: baseUi,
    };
    const issues = validateWorkflowStructure(wf);
    expect(issues.some((i) => i.code === "no-path-start-to-end")).toBe(true);
    expect(issues.some((i) => i.code === "cannot-reach-end" && i.nodeIds?.includes("agent-1"))).toBe(true);
  });

  it("flags a flow node that is unreachable from start", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [
        makeNode("start-1", WorkflowNodeType.Start),
        makeNode("agent-1", WorkflowNodeType.Agent),
        makeNode("orphan-1", WorkflowNodeType.Agent),
        makeNode("end-1", WorkflowNodeType.End),
      ],
      edges: [
        makeEdge("e1", "start-1", "agent-1"),
        makeEdge("e2", "agent-1", "end-1"),
        // orphan-1 connects to end but nothing reaches it
        makeEdge("e3", "orphan-1", "end-1"),
      ],
      ui: baseUi,
    };
    const issues = validateWorkflowStructure(wf);
    expect(issues.some(
      (i) => i.code === "unreachable-from-start" && i.nodeIds?.includes("orphan-1"),
    )).toBe(true);
  });

  it("does NOT require skill / document nodes to lie on the flow path", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [
        makeNode("start-1", WorkflowNodeType.Start),
        makeNode("agent-1", WorkflowNodeType.Agent),
        makeNode("end-1", WorkflowNodeType.End),
        makeNode("skill-1", WorkflowNodeType.Skill),
        makeNode("doc-1", WorkflowNodeType.Document),
      ],
      edges: [
        makeEdge("e1", "start-1", "agent-1"),
        makeEdge("e2", "agent-1", "end-1"),
        makeEdge("e3", "skill-1", "agent-1", { sourceHandle: "skill-out", targetHandle: "skills" }),
        makeEdge("e4", "doc-1", "agent-1", { sourceHandle: "doc-out", targetHandle: "docs" }),
      ],
      ui: baseUi,
    };
    expect(validateWorkflowStructure(wf).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("warns on orphan attachment nodes", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [
        makeNode("start-1", WorkflowNodeType.Start),
        makeNode("agent-1", WorkflowNodeType.Agent),
        makeNode("end-1", WorkflowNodeType.End),
        makeNode("skill-1", WorkflowNodeType.Skill),
      ],
      edges: [
        makeEdge("e1", "start-1", "agent-1"),
        makeEdge("e2", "agent-1", "end-1"),
        // skill-1 has no edge to any agent
      ],
      ui: baseUi,
    };
    const issues = validateWorkflowStructure(wf);
    expect(issues.some(
      (i) => i.code === "orphan-attachment" && i.severity === "warning",
    )).toBe(true);
  });

  it("handles a branching if-else that merges back to end", () => {
    const wf: WorkflowJSON = {
      name: "t",
      nodes: [
        makeNode("start-1", WorkflowNodeType.Start),
        makeNode("if-1", WorkflowNodeType.IfElse),
        makeNode("agent-a", WorkflowNodeType.Agent),
        makeNode("agent-b", WorkflowNodeType.Agent),
        makeNode("end-1", WorkflowNodeType.End),
      ],
      edges: [
        makeEdge("e1", "start-1", "if-1"),
        makeEdge("e2", "if-1", "agent-a", { sourceHandle: "true" }),
        makeEdge("e3", "if-1", "agent-b", { sourceHandle: "false" }),
        makeEdge("e4", "agent-a", "end-1"),
        makeEdge("e5", "agent-b", "end-1"),
      ],
      ui: baseUi,
    };
    expect(validateWorkflowStructure(wf).filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("summarizeStructuralIssues", () => {
  it("formats errors and warnings", () => {
    const summary = summarizeStructuralIssues([
      { severity: "error", code: "no-path-start-to-end", message: "x" },
      { severity: "error", code: "cannot-reach-end", message: "y" },
      { severity: "warning", code: "orphan-attachment", message: "z" },
    ]);
    expect(summary).toBe("2 structural errors, 1 warning");
  });

  it("returns empty string when there are no issues", () => {
    expect(summarizeStructuralIssues([])).toBe("");
  });
});

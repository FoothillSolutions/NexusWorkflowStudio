import { describe, expect, it } from "bun:test";
import { WorkflowNodeType } from "@/types/workflow";
import { createSwitchBranch } from "@/nodes/switch/branches";
import { fixEdgeHandles } from "../../workflow-gen/edge-fixer";

describe("fixEdgeHandles", () => {
  it("normalizes handles for if-else, switch, ask-user, and parallel-agent edges", () => {
    const nodeTypeMap = new Map([
      ["if-1", { type: WorkflowNodeType.IfElse }],
      [
        "switch-1",
        {
          type: WorkflowNodeType.Switch,
          branches: [
            createSwitchBranch({ id: "switch-branch-pending", label: "Pending", condition: "" }),
            createSwitchBranch({ id: "switch-branch-done", label: "Done", condition: "" }),
          ],
        },
      ],
      [
        "ask-1",
        {
          type: WorkflowNodeType.AskUser,
          options: [{ label: "Yes" }, { label: "No" }],
          multipleSelection: false,
          aiSuggestOptions: false,
        },
      ],
      [
        "parallel-1",
        { type: WorkflowNodeType.ParallelAgent, spawnMode: "fixed" as const, branches: [{ label: "A" }, { label: "B" }] },
      ],
    ]);

    const fixed = fixEdgeHandles(
      [
        { id: "e1", source: "if-1", target: "a", sourceHandle: "branch-0" },
        { id: "e2", source: "if-1", target: "b", sourceHandle: "1" },
        { id: "e3", source: "switch-1", target: "c", sourceHandle: "branch-1" },
        { id: "e3b", source: "switch-1", target: "c2", sourceHandle: "Pending" },
        { id: "e4", source: "ask-1", target: "d", sourceHandle: "branch-1" },
        { id: "e5", source: "parallel-1", target: "e", sourceHandle: "branch-0" },
        { id: "e6", source: "unknown", target: "f", sourceHandle: "output" },
      ],
      nodeTypeMap,
    );

    expect(fixed[0].sourceHandle).toBe("true");
    expect(fixed[1].sourceHandle).toBe("false");
    expect(fixed[2].sourceHandle).toBe("switch-branch-done");
    expect(fixed[3].sourceHandle).toBe("switch-branch-pending");
    expect(fixed[4].sourceHandle).toBe("option-1");
    expect(fixed[5].sourceHandle).toBe("branch-0");
    expect(fixed.every((edge) => edge.type === "deletable")).toBe(true);
  });

  it("coerces stray dynamic-mode parallel-agent sourceHandles to 'output'", () => {
    const nodeTypeMap = new Map([
      [
        "parallel-d",
        { type: WorkflowNodeType.ParallelAgent, spawnMode: "dynamic" as const, branches: [] },
      ],
    ]);

    const fixed = fixEdgeHandles(
      [
        { id: "e1", source: "parallel-d", target: "agent-a", sourceHandle: "branch-0" },
        { id: "e2", source: "parallel-d", target: "agent-b", sourceHandle: "foo" },
        { id: "e3", source: "parallel-d", target: "agent-c", sourceHandle: "output" },
      ],
      nodeTypeMap,
    );

    expect(fixed[0].sourceHandle).toBe("output");
    expect(fixed[1].sourceHandle).toBe("output");
    expect(fixed[2].sourceHandle).toBe("output");
    expect(fixed.every((edge) => edge.type === "deletable")).toBe(true);
  });

  it("preserves fixed-mode parallel-agent branch-0 normalization (regression guard)", () => {
    const nodeTypeMap = new Map([
      [
        "parallel-f",
        { type: WorkflowNodeType.ParallelAgent, spawnMode: "fixed" as const, branches: [{ label: "A" }] },
      ],
    ]);

    const fixed = fixEdgeHandles(
      [{ id: "e1", source: "parallel-f", target: "agent-a", sourceHandle: "branch-0" }],
      nodeTypeMap,
    );

    expect(fixed[0].sourceHandle).toBe("branch-0");
  });
});


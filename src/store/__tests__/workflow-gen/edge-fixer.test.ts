import { describe, expect, it } from "bun:test";
import { fixEdgeHandles } from "../../workflow-gen/edge-fixer";

describe("fixEdgeHandles", () => {
  it("normalizes handles for if-else, switch, ask-user, and parallel-agent edges", () => {
    const nodeTypeMap = new Map([
      ["if-1", { type: "if-else" }],
      [
        "switch-1",
        { type: "switch", branches: [{ label: "Pending" }, { label: "Done" }] },
      ],
      [
        "ask-1",
        {
          type: "ask-user",
          options: [{ label: "Yes" }, { label: "No" }],
          multipleSelection: false,
          aiSuggestOptions: false,
        },
      ],
      [
        "parallel-1",
        { type: "parallel-agent", branches: [{ label: "A" }, { label: "B" }] },
      ],
    ]);

    const fixed = fixEdgeHandles(
      [
        { id: "e1", source: "if-1", target: "a", sourceHandle: "branch-0" },
        { id: "e2", source: "if-1", target: "b", sourceHandle: "1" },
        { id: "e3", source: "switch-1", target: "c", sourceHandle: "branch-1" },
        { id: "e4", source: "ask-1", target: "d", sourceHandle: "branch-1" },
        { id: "e5", source: "parallel-1", target: "e", sourceHandle: "branch-0" },
        { id: "e6", source: "unknown", target: "f", sourceHandle: "output" },
      ],
      nodeTypeMap,
    );

    expect(fixed[0].sourceHandle).toBe("true");
    expect(fixed[1].sourceHandle).toBe("false");
    expect(fixed[2].sourceHandle).toBe("Done");
    expect(fixed[3].sourceHandle).toBe("option-1");
    expect(fixed[4].sourceHandle).toBe("branch-0");
    expect(fixed.every((edge) => edge.type === "deletable")).toBe(true);
  });
});


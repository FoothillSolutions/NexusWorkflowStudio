import { describe, expect, it, beforeEach } from "bun:test";
import { useWorkflowGenStore } from "../../workflow-gen";

describe("workflow-gen mode state", () => {
  beforeEach(() => {
    // Reset to a clean baseline before each test
    useWorkflowGenStore.setState({
      mode: "generate",
      status: "idle",
      prompt: "",
      sessionId: null,
      streamedText: "",
      parsedNodeCount: 0,
      parsedEdgeCount: 0,
      tokenCount: 0,
      error: null,
    });
  });

  it("defaults mode to 'generate'", () => {
    expect(useWorkflowGenStore.getState().mode).toBe("generate");
  });

  it("updates mode via setMode", () => {
    useWorkflowGenStore.getState().setMode("edit");
    expect(useWorkflowGenStore.getState().mode).toBe("edit");

    useWorkflowGenStore.getState().setMode("generate");
    expect(useWorkflowGenStore.getState().mode).toBe("generate");
  });

  it("preserves mode across reset() so Retry stays in Edit", () => {
    useWorkflowGenStore.getState().setMode("edit");
    useWorkflowGenStore.getState().reset();
    expect(useWorkflowGenStore.getState().mode).toBe("edit");
  });

  it("resets mode to 'generate' when disposeSession() runs", async () => {
    useWorkflowGenStore.getState().setMode("edit");
    await useWorkflowGenStore.getState().disposeSession();
    expect(useWorkflowGenStore.getState().mode).toBe("generate");
  });
});

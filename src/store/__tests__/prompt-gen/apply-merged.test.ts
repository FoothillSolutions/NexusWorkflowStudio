import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { WorkflowNodeType } from "@/types/workflow";
import { makeWorkflowNode } from "@/test-support/workflow-fixtures";
import { usePromptGenStore } from "../../prompt-gen";
import { useWorkflowStore } from "../../workflow";

function resetPromptGen() {
  usePromptGenStore.setState({
    sessionId: null,
    status: "idle",
    generatedText: "",
    generatedTokens: 0,
    error: null,
    _abortController: null,
    _formSetValue: null,
    view: "closed",
    mode: "freeform",
    freeformText: "",
    editInstruction: "",
    fields: {},
    expandedSections: new Set<string>(),
    targetNodeId: null,
    targetNodeType: null,
    targetField: "promptText",
    targetPrompt: "",
    floating: false,
    collapsed: false,
    diffReviewOpen: false,
  });
}

describe("openDiffReview", () => {
  beforeEach(() => {
    resetPromptGen();
  });

  it("opens the dialog only when status is done and generatedText is non-empty", () => {
    usePromptGenStore.setState({ status: "done", generatedText: "hello world" });
    usePromptGenStore.getState().openDiffReview();
    expect(usePromptGenStore.getState().diffReviewOpen).toBe(true);
  });

  it("does nothing when status is not done", () => {
    usePromptGenStore.setState({ status: "streaming", generatedText: "hello" });
    usePromptGenStore.getState().openDiffReview();
    expect(usePromptGenStore.getState().diffReviewOpen).toBe(false);
  });

  it("does nothing when generatedText is empty whitespace", () => {
    usePromptGenStore.setState({ status: "done", generatedText: "   \n   " });
    usePromptGenStore.getState().openDiffReview();
    expect(usePromptGenStore.getState().diffReviewOpen).toBe(false);
  });
});

describe("closeDiffReview", () => {
  beforeEach(() => resetPromptGen());

  it("closes the dialog without wiping generatedText or status", () => {
    usePromptGenStore.setState({
      status: "done",
      generatedText: "keep me",
      diffReviewOpen: true,
    });
    usePromptGenStore.getState().closeDiffReview();
    const state = usePromptGenStore.getState();
    expect(state.diffReviewOpen).toBe(false);
    expect(state.generatedText).toBe("keep me");
    expect(state.status).toBe("done");
  });
});

describe("applyMergedResult", () => {
  beforeEach(() => {
    resetPromptGen();
  });

  afterEach(() => {
    resetPromptGen();
  });

  it("writes the merged text through _formSetValue when registered", () => {
    const setValue = mock((_field: string, _value: string, _opts: { shouldDirty: boolean }) => {});
    usePromptGenStore.setState({
      status: "done",
      generatedText: "full generated output",
      targetNodeId: "node-1",
      targetField: "promptText",
      targetNodeType: WorkflowNodeType.Agent,
      diffReviewOpen: true,
      _formSetValue: setValue as never,
    });

    usePromptGenStore.getState().applyMergedResult("merged output");

    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith("promptText", "merged output", { shouldDirty: true });

    const next = usePromptGenStore.getState();
    expect(next.diffReviewOpen).toBe(false);
    expect(next.generatedText).toBe("");
    expect(next.status).toBe("idle");
    expect(next.view).toBe("closed");
  });

  it("falls back to workflowStore.updateNodeData when no _formSetValue is registered", () => {
    // Seed the workflow store with a main-canvas node.
    useWorkflowStore.setState({
      nodes: [
        makeWorkflowNode({
          id: "node-1",
          type: WorkflowNodeType.Agent,
          data: {
            type: WorkflowNodeType.Agent,
            label: "Agent",
            name: "agent-1",
            promptText: "original",
            detectedVariables: [],
            tools: [],
            mcp: [],
          } as never,
        }),
      ],
    });

    usePromptGenStore.setState({
      status: "done",
      generatedText: "full generated output",
      targetNodeId: "node-1",
      targetField: "promptText",
      targetNodeType: WorkflowNodeType.Agent,
      diffReviewOpen: true,
      _formSetValue: null,
    });

    usePromptGenStore.getState().applyMergedResult("merged via fallback");

    const node = useWorkflowStore.getState().nodes.find((n) => n.id === "node-1");
    expect(node).toBeDefined();
    expect((node!.data as { promptText?: string }).promptText).toBe("merged via fallback");
  });

  it("falls back to updateSubNodeData when the target node lives in a sub-workflow", () => {
    useWorkflowStore.setState({
      nodes: [],
      subWorkflowNodes: [
        makeWorkflowNode({
          id: "sub-node-1",
          type: WorkflowNodeType.Prompt,
          data: {
            type: WorkflowNodeType.Prompt,
            label: "Prompt",
            name: "prompt-1",
            promptText: "original",
            detectedVariables: [],
          } as never,
        }),
      ],
    });

    usePromptGenStore.setState({
      status: "done",
      generatedText: "full generated output",
      targetNodeId: "sub-node-1",
      targetField: "promptText",
      targetNodeType: WorkflowNodeType.Prompt,
      diffReviewOpen: true,
      _formSetValue: null,
    });

    usePromptGenStore.getState().applyMergedResult("merged via sub fallback");

    const node = useWorkflowStore.getState().subWorkflowNodes.find((n) => n.id === "sub-node-1");
    expect(node).toBeDefined();
    expect((node!.data as { promptText?: string }).promptText).toBe("merged via sub fallback");
  });
});

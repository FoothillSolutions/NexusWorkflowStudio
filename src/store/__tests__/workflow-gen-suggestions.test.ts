import { describe, expect, it, beforeEach, mock } from "bun:test";
import { useWorkflowGenStore } from "../workflow-gen";
import type { WorkflowEnhancementSuggestion } from "../workflow-gen";

function resetSuggestionsState() {
  useWorkflowGenStore.setState({
    // Main gen state (baseline)
    floating: false,
    collapsed: false,
    status: "idle",
    mode: "generate",
    prompt: "",
    sessionId: null,
    streamedText: "",
    parsedNodeCount: 0,
    parsedEdgeCount: 0,
    tokenCount: 0,
    error: null,
    _abortController: null,
    _addedNodeIds: new Set(),
    _addedEdgeIds: new Set(),
    _pendingEdges: [],
    _glowingNodeIds: [],
    // Suggestions state
    suggestionsOpen: false,
    suggestionsStatus: "idle",
    suggestions: [],
    suggestionsError: null,
    _suggestionsSessionId: null,
    _suggestionsAbortController: null,
  });
}

describe("workflow-gen suggestions actions", () => {
  beforeEach(() => {
    resetSuggestionsState();
  });

  it("openSuggestions() flips suggestionsOpen to true", () => {
    // Stub fetchSuggestions so the auto-fetch doesn't run real logic
    const stubbed = mock(() => Promise.resolve());
    useWorkflowGenStore.setState({ fetchSuggestions: stubbed });

    useWorkflowGenStore.getState().openSuggestions();
    expect(useWorkflowGenStore.getState().suggestionsOpen).toBe(true);
  });

  it("openSuggestions() triggers fetchSuggestions() when status is idle", () => {
    const stubbed = mock(() => Promise.resolve());
    useWorkflowGenStore.setState({ fetchSuggestions: stubbed });

    useWorkflowGenStore.getState().openSuggestions();
    expect(stubbed).toHaveBeenCalledTimes(1);
  });

  it("openSuggestions() does NOT trigger fetchSuggestions() when status is loading", () => {
    const stubbed = mock(() => Promise.resolve());
    useWorkflowGenStore.setState({
      fetchSuggestions: stubbed,
      suggestionsStatus: "loading",
    });

    useWorkflowGenStore.getState().openSuggestions();
    expect(stubbed).not.toHaveBeenCalled();
  });

  it("openSuggestions() does NOT trigger fetchSuggestions() when status is done", () => {
    const stubbed = mock(() => Promise.resolve());
    useWorkflowGenStore.setState({
      fetchSuggestions: stubbed,
      suggestionsStatus: "done",
    });

    useWorkflowGenStore.getState().openSuggestions();
    expect(stubbed).not.toHaveBeenCalled();
  });

  it("closeSuggestions() sets suggestionsOpen to false", () => {
    useWorkflowGenStore.setState({ suggestionsOpen: true });
    useWorkflowGenStore.getState().closeSuggestions();
    expect(useWorkflowGenStore.getState().suggestionsOpen).toBe(false);
  });

  it("closeSuggestions() aborts in-flight controller when loading", () => {
    const abortController = new AbortController();
    const spy = mock(() => {});
    abortController.signal.addEventListener("abort", spy);

    useWorkflowGenStore.setState({
      suggestionsOpen: true,
      suggestionsStatus: "loading",
      _suggestionsAbortController: abortController,
    });

    useWorkflowGenStore.getState().closeSuggestions();

    expect(abortController.signal.aborted).toBe(true);
    expect(spy).toHaveBeenCalled();
    expect(useWorkflowGenStore.getState().suggestionsOpen).toBe(false);
  });

  it("cancelSuggestions() aborts and resets status to idle", () => {
    const abortController = new AbortController();
    useWorkflowGenStore.setState({
      suggestionsStatus: "loading",
      _suggestionsAbortController: abortController,
    });

    useWorkflowGenStore.getState().cancelSuggestions();

    expect(abortController.signal.aborted).toBe(true);
    expect(useWorkflowGenStore.getState().suggestionsStatus).toBe("idle");
    expect(useWorkflowGenStore.getState()._suggestionsAbortController).toBeNull();
  });

  it("resetSuggestions() clears suggestions, status, and error", () => {
    useWorkflowGenStore.setState({
      suggestions: [{ id: "a", title: "t", description: "d" }],
      suggestionsStatus: "done",
      suggestionsError: "some error",
    });

    useWorkflowGenStore.getState().resetSuggestions();

    const state = useWorkflowGenStore.getState();
    expect(state.suggestions).toEqual([]);
    expect(state.suggestionsStatus).toBe("idle");
    expect(state.suggestionsError).toBeNull();
  });

  it("applySuggestion() sets mode, prompt, opens collapsed floating panel, and closes modal", async () => {
    const generateStub = mock(() => Promise.resolve());
    useWorkflowGenStore.setState({
      suggestionsOpen: true,
      generate: generateStub,
      // Make generate() observe a "done" final status so the success toast path runs
      status: "done",
    });

    const suggestion: WorkflowEnhancementSuggestion = {
      id: "sug-1",
      title: "Add an error branch",
      description: "Wire a new if-else branch after the agent to handle API errors.",
    };

    await useWorkflowGenStore.getState().applySuggestion(suggestion);

    const state = useWorkflowGenStore.getState();
    expect(state.mode).toBe("edit");
    expect(state.prompt).toBe(`${suggestion.title}\n\n${suggestion.description}`);
    expect(state.suggestionsOpen).toBe(false);
    expect(state.floating).toBe(true);
    expect(state.collapsed).toBe(true);
    expect(generateStub).toHaveBeenCalledTimes(1);
  });

  it("disposeSession() aborts and resets suggestions state", async () => {
    const abortController = new AbortController();
    useWorkflowGenStore.setState({
      suggestionsOpen: true,
      suggestionsStatus: "loading",
      suggestions: [{ id: "x", title: "t", description: "d" }],
      suggestionsError: "oh no",
      _suggestionsSessionId: "sess-123",
      _suggestionsAbortController: abortController,
    });

    await useWorkflowGenStore.getState().disposeSession();

    const state = useWorkflowGenStore.getState();
    expect(abortController.signal.aborted).toBe(true);
    expect(state.suggestionsOpen).toBe(false);
    expect(state.suggestionsStatus).toBe("idle");
    expect(state.suggestions).toEqual([]);
    expect(state.suggestionsError).toBeNull();
    expect(state._suggestionsSessionId).toBeNull();
    expect(state._suggestionsAbortController).toBeNull();
  });
});

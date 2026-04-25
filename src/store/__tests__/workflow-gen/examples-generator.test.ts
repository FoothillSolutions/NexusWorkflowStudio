import { afterEach, describe, expect, it, mock } from "bun:test";
import { useOpenCodeStore } from "../../opencode";
import { fetchAiExamples } from "../../workflow-gen/examples-generator";
import type { WorkflowGenState, StoreSet } from "../../workflow-gen/types";

const originalOpenCodeState = useOpenCodeStore.getState();

function createState(overrides: Partial<WorkflowGenState> = {}): WorkflowGenState {
  return {
    floating: false,
    collapsed: false,
    status: "idle",
    prompt: "",
    selectedModel: "github-copilot/claude-sonnet-4.6",
    streamedText: "",
    parsedNodeCount: 0,
    parsedEdgeCount: 0,
    tokenCount: 0,
    error: null,
    sessionId: null,
    _abortController: null,
    _addedNodeIds: new Set<string>(),
    _addedEdgeIds: new Set<string>(),
    _pendingEdges: [],
    _glowingNodeIds: [],
    useProjectContext: false,
    projectContext: null,
    projectContextStatus: "idle",
    aiExamples: [],
    aiExamplesStatus: "idle",
    _examplesSessionId: null,
    _examplesAbortController: null,
    setFloating: () => {},
    toggleCollapsed: () => {},
    close: () => {},
    setPrompt: () => {},
    setSelectedModel: () => {},
    setUseProjectContext: () => {},
    fetchProjectContext: async () => {},
    generate: async () => {},
    cancel: () => {},
    reset: () => {},
    disposeSession: async () => {},
    fetchAiExamples: async () => {},
    ...overrides,
  };
}

function createSet(getState: () => WorkflowGenState, setState: (next: WorkflowGenState) => void): StoreSet {
  return (partial) => {
    const current = getState();
    const nextPartial = typeof partial === "function" ? partial(current) : partial;
    setState({ ...current, ...nextPartial });
  };
}

afterEach(() => {
  useOpenCodeStore.setState(originalOpenCodeState);
});

describe("fetchAiExamples", () => {
  it("uses the synchronous message response so ACP-backed example generation does not depend on SSE timing", async () => {
    let state = createState();
    const set = createSet(() => state, (next) => {
      state = next;
    });

    const client = {
      sessions: {
        create: mock(async () => ({ id: "examples-session-1" })),
      },
      messages: {
        send: mock(async () => ({
          info: { role: "assistant" },
          parts: [{ type: "text", text: '["Build a triage workflow","Create an onboarding approval flow"]' }],
        })),
      },
    };

    useOpenCodeStore.setState({ client: client as never });

    await fetchAiExamples(set, () => state);

    expect(client.sessions.create).toHaveBeenCalledWith({ title: "Nexus Workflow Examples" });
    expect(client.messages.send).toHaveBeenCalledTimes(1);
    expect(client.messages.send).toHaveBeenCalledWith(
      "examples-session-1",
      expect.any(Object),
      expect.objectContaining({
        signal: expect.anything(),
        timeout: 120_000,
      }),
    );
    expect(state._examplesSessionId).toBe("examples-session-1");
    expect(state.aiExamplesStatus).toBe("done");
    expect(state.aiExamples).toEqual([
      "Build a triage workflow",
      "Create an onboarding approval flow",
    ]);
  });

  it("preserves existing examples when prepending and deduplicates overlaps", async () => {
    let state = createState({
      _examplesSessionId: "examples-session-2",
      aiExamples: ["Existing example", "Keep me"],
      aiExamplesStatus: "done",
    });
    const set = createSet(() => state, (next) => {
      state = next;
    });

    const client = {
      sessions: {
        create: mock(async () => {
          throw new Error("should not create a new session");
        }),
      },
      messages: {
        send: mock(async () => ({
          info: { role: "assistant" },
          parts: [{ type: "text", text: '["New example","Existing example"]' }],
        })),
      },
    };

    useOpenCodeStore.setState({ client: client as never });

    await fetchAiExamples(set, () => state, { prepend: true });

    expect(client.sessions.create).not.toHaveBeenCalled();
    expect(state.aiExamplesStatus).toBe("done");
    expect(state.aiExamples).toEqual([
      "New example",
      "Existing example",
      "Keep me",
    ]);
  });
});


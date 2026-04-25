import { afterEach, describe, expect, it, mock } from "bun:test";
import { useSavedWorkflowsStore } from "../../library";
import { useOpenCodeStore } from "../../opencode";
import { useWorkflowStore } from "../../workflow";
import { generate } from "../../workflow-gen/workflow-generator";
import type { WorkflowGenState, StoreSet } from "../../workflow-gen/types";

const originalOpenCodeState = useOpenCodeStore.getState();
const originalWorkflowState = useWorkflowStore.getState();
const originalLibraryState = useSavedWorkflowsStore.getState();
const originalWindow = globalThis.window;
const originalCustomEvent = globalThis.CustomEvent;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

function createEvents(values: unknown[]) {
  return {
    async *subscribe() {
      for (const value of values) {
        yield value;
      }
    },
  };
}

function createState(overrides: Partial<WorkflowGenState> = {}): WorkflowGenState {
  return {
    floating: false,
    collapsed: false,
    status: "idle",
    mode: "generate",
    prompt: "Route inbound customer issues by severity",
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
    suggestionsOpen: false,
    suggestionsStatus: "idle",
    suggestions: [],
    suggestionsError: null,
    _suggestionsSessionId: null,
    _suggestionsAbortController: null,
    setFloating: () => {},
    toggleCollapsed: () => {},
    close: () => {},
    setPrompt: () => {},
    setSelectedModel: () => {},
    setMode: () => {},
    setUseProjectContext: () => {},
    fetchProjectContext: async () => {},
    generate: async () => {},
    cancel: () => {},
    reset: () => {},
    disposeSession: async () => {},
    fetchAiExamples: async () => {},
    openSuggestions: () => {},
    closeSuggestions: () => {},
    fetchSuggestions: async () => {},
    cancelSuggestions: () => {},
    resetSuggestions: () => {},
    applySuggestion: async () => {},
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
  useWorkflowStore.setState(originalWorkflowState);
  useSavedWorkflowsStore.setState(originalLibraryState);
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  }
  globalThis.CustomEvent = originalCustomEvent;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

describe("workflow-generator", () => {
  it("streams workflow deltas to the canvas while ACP generation is in flight", async () => {
    let state = createState();
    const set = createSet(() => state, (next) => {
      state = next;
    });

    const dispatchEvent = mock(() => true);
    Object.defineProperty(globalThis, "window", {
      value: { dispatchEvent },
      configurable: true,
      writable: true,
    });
    globalThis.CustomEvent = class CustomEvent<T = unknown> extends Event {
      detail: T | null;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail ?? null;
      }
    } as unknown as typeof CustomEvent;
    globalThis.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler();
      }
      return 0 as never;
    }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = (() => {}) as typeof clearTimeout;

    const client = {
      sessions: {
        create: mock(async () => ({ id: "workflow-session-1" })),
      },
      events: createEvents([
        {
          type: "message.part.delta",
          properties: {
            sessionID: "workflow-session-1",
            field: "text",
            delta: '{"name":"Customer Issue Router","nodes":[',
          },
        },
        {
          type: "message.part.delta",
          properties: {
            sessionID: "workflow-session-1",
            field: "text",
            delta: '{"id":"start-1","type":"start","position":{"x":0,"y":0},"data":{"type":"start","label":"Start","name":"Start"}},',
          },
        },
        {
          type: "message.part.delta",
          properties: {
            sessionID: "workflow-session-1",
            field: "text",
            delta: '{"id":"agent-1","type":"agent","position":{"x":280,"y":0},"data":{"type":"agent","label":"Agent","name":"Classifier","promptText":"Classify the inbound issue by severity."}},',
          },
        },
        {
          type: "message.part.delta",
          properties: {
            sessionID: "workflow-session-1",
            field: "text",
            delta: '{"id":"end-1","type":"end","position":{"x":560,"y":0},"data":{"type":"end","label":"End","name":"End"}}],"edges":[{"id":"edge-1","source":"start-1","target":"agent-1"},{"id":"edge-2","source":"agent-1","target":"end-1"}],"ui":{"sidebarOpen":false,"minimapVisible":true,"viewport":{"x":0,"y":0,"zoom":1}}}',
          },
        },
        {
          type: "session.idle",
          properties: { sessionID: "workflow-session-1" },
        },
      ]),
      messages: {
        sendAsync: mock(async () => undefined),
        list: mock(async () => []),
      },
    };

    useOpenCodeStore.setState({ client: client as never });

    await generate(set, () => state);

    expect(client.sessions.create).toHaveBeenCalledWith(
      { title: "Nexus Workflow Generator" },
      expect.objectContaining({
        signal: expect.anything(),
        timeout: 300_000,
      }),
    );
    expect(client.messages.sendAsync).toHaveBeenCalledTimes(1);
    expect(client.messages.sendAsync).toHaveBeenCalledWith(
      "workflow-session-1",
      expect.any(Object),
      expect.objectContaining({
        signal: expect.anything(),
        timeout: 300_000,
      }),
    );
    expect(state.sessionId).toBe("workflow-session-1");
    expect(state.status).toBe("done");
    expect(state.error).toBeNull();
    expect(state._abortController).toBeNull();
    expect(state.streamedText).toContain('"Customer Issue Router"');
    expect(state.parsedNodeCount).toBe(3);
    expect(state.parsedEdgeCount).toBe(2);
    expect(useWorkflowStore.getState().name).toBe("Customer Issue Router");
    expect(useWorkflowStore.getState().nodes.map((node) => node.id)).toEqual([
      "start-1",
      "agent-1",
      "end-1",
    ]);
    expect(dispatchEvent).toHaveBeenCalled();
  });

  it("reconciles with the final assistant message when early ACP stream chunks are missed", async () => {
    let state = createState();
    const set = createSet(() => state, (next) => {
      state = next;
    });

    Object.defineProperty(globalThis, "window", {
      value: { dispatchEvent: mock(() => true) },
      configurable: true,
      writable: true,
    });
    globalThis.CustomEvent = class CustomEvent<T = unknown> extends Event {
      detail: T | null;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail ?? null;
      }
    } as unknown as typeof CustomEvent;
    globalThis.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === "function") handler();
      return 0 as never;
    }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = (() => {}) as typeof clearTimeout;

    const finalJson = JSON.stringify({
      name: "Recovered Workflow",
      nodes: [
        { id: "start-1", type: "start", position: { x: 0, y: 0 }, data: { type: "start", label: "Start", name: "Start" } },
        { id: "end-1", type: "end", position: { x: 300, y: 0 }, data: { type: "end", label: "End", name: "End" } },
      ],
      edges: [{ id: "edge-1", source: "start-1", target: "end-1" }],
      ui: { sidebarOpen: false, minimapVisible: true, viewport: { x: 0, y: 0, zoom: 1 } },
    });

    const client = {
      sessions: {
        create: mock(async () => ({ id: "workflow-session-1" })),
      },
      events: createEvents([
        {
          type: "message.part.delta",
          properties: { sessionID: "workflow-session-1", field: "text", delta: '{"name":"Recovered Workflow"' },
        },
        {
          type: "session.idle",
          properties: { sessionID: "workflow-session-1" },
        },
      ]),
      messages: {
        sendAsync: mock(async () => undefined),
        list: mock(async () => [{ info: { role: "assistant" }, parts: [{ type: "text", text: finalJson }] }]),
      },
    };

    useOpenCodeStore.setState({ client: client as never });

    await generate(set, () => state);

    expect(client.messages.list).toHaveBeenCalledWith("workflow-session-1", 2);
    expect(state.status).toBe("done");
    expect(state._abortController).toBeNull();
    expect(useWorkflowStore.getState().name).toBe("Recovered Workflow");
    expect(useWorkflowStore.getState().edges).toHaveLength(1);
  });

  it("cleans up to idle when an in-flight streamed generation is aborted", async () => {
    let state = createState();
    const set = createSet(() => state, (next) => {
      state = next;
    });

    Object.defineProperty(globalThis, "window", {
      value: { dispatchEvent: mock(() => true) },
      configurable: true,
      writable: true,
    });
    globalThis.CustomEvent = class CustomEvent<T = unknown> extends Event {
      detail: T | null;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail ?? null;
      }
    } as unknown as typeof CustomEvent;
    globalThis.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === "function") handler();
      return 0 as never;
    }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = (() => {}) as typeof clearTimeout;

    const client = {
      sessions: {
        create: mock(async () => ({ id: "workflow-session-1" })),
      },
      events: {
        subscribe: ({ signal }: { signal?: AbortSignal }) => (async function* () {
          yield {
            type: "message.part.delta",
            properties: { sessionID: "workflow-session-1", field: "text", delta: '{"name":"Abortable Workflow"' },
          };
          await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
        })(),
      },
      messages: {
        sendAsync: mock(async () => undefined),
        list: mock(async () => []),
      },
    };

    useOpenCodeStore.setState({ client: client as never });

    const generationPromise = generate(set, () => state);
    await Promise.resolve();
    state._abortController?.abort();
    await generationPromise;

    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
    expect(state._abortController).toBeNull();
  });
});





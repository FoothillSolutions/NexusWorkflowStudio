// AI Workflow Generation Store

// Manages sessions for AI-powered workflow generation from natural language.
// Sends a system prompt with the full node catalogue + schema to an LLM,
// streams back a WorkflowJSON, incrementally parses it, and loads it onto
// the canvas in real-time.
//
// This store is a thin orchestrator — heavy logic lives in sibling modules:
//   - system-prompt.ts     → LLM system prompt construction
//   - streaming-parser.ts  → Incremental JSON extraction from SSE streams
//   - edge-fixer.ts        → Normalise branching edge handles
//   - project-context.ts   → Fetch project file tree for context
//   - examples-generator.ts → AI-generated example prompts
//   - workflow-generator.ts → Core generate() logic + canvas updates

import { create } from "zustand";
import { useOpenCodeStore } from "../opencode";
import { useWorkflowStore } from "../workflow";
import type { WorkflowGenState } from "./types";
import { fetchProjectContext } from "./project-context";
import { fetchAiExamples } from "./examples-generator";
import { generate } from "./workflow-generator";

// Re-export types for consumers
export type { WorkflowGenStatus, WorkflowGenState } from "./types";

// ── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowGenStore = create<WorkflowGenState>((set, get) => ({
  // State

  floating: false,
  collapsed: false,
  status: "idle",
  prompt: "",
  selectedModel: null,
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

  // Project folder context

  useProjectContext: false,
  projectContext: null,
  projectContextStatus: "idle",

  // AI examples ──
  aiExamples: [],
  aiExamplesStatus: "idle",
  _examplesSessionId: null,
  _examplesAbortController: null,

  // UI Actions

  setFloating: (open) => {
    if (!open) {
      const { status, _abortController } = get();
      if (status === "streaming" || status === "creating-session") {
        _abortController?.abort();
      }
    }
    set({ floating: open });
  },

  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),

  close: () => {
    const { status, _abortController } = get();
    if (status === "streaming" || status === "creating-session") {
      _abortController?.abort();
    }
    set({ floating: false });
  },

  setPrompt: (prompt) => set({ prompt }),
  setSelectedModel: (model) => set({ selectedModel: model }),

  setUseProjectContext: (use) => {
    set({ useProjectContext: use });
    if (use && get().projectContextStatus === "idle") {
      // Auto-fetch when toggled on
      get().fetchProjectContext();
    }
  },

  // Delegated Actions

  fetchProjectContext: () => fetchProjectContext(set, get),
  generate: () => generate(set, get),
  fetchAiExamples: (opts) => fetchAiExamples(set, get, opts),

  // Cancel / Reset / Dispose

  cancel: () => {
    const { _abortController, sessionId } = get();
    _abortController?.abort();

    const client = useOpenCodeStore.getState().client;
    if (client && sessionId) {
      client.sessions.abort(sessionId).catch(() => {});
    }

    // Resume undo/redo in case it was paused
    try { useWorkflowStore.temporal.getState().resume(); } catch { /* ignore */ }

    set({
      status: "idle",
      _abortController: null,
      _addedNodeIds: new Set(),
      _addedEdgeIds: new Set(),
      _pendingEdges: [],
      _glowingNodeIds: [],
    });
  },

  reset: () => {
    set({
      status: "idle",
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
    });
  },

  disposeSession: async () => {
    const { sessionId, _abortController, _examplesSessionId, _examplesAbortController } = get();
    _abortController?.abort();
    _examplesAbortController?.abort();

    const client = useOpenCodeStore.getState().client;
    if (client) {
      if (sessionId) {
        try {
          await client.sessions.abort(sessionId).catch(() => {});
          await client.sessions.delete(sessionId).catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
      if (_examplesSessionId) {
        try {
          await client.sessions.abort(_examplesSessionId).catch(() => {});
          await client.sessions.delete(_examplesSessionId).catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    set({
      sessionId: null,
      status: "idle",
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
      aiExamples: [],
      aiExamplesStatus: "idle",
      _examplesSessionId: null,
      _examplesAbortController: null,
      projectContext: null,
      projectContextStatus: "idle",
    });
  },
}));


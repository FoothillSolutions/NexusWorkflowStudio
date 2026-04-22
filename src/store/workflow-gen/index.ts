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
import { toast } from "sonner";
import { useOpenCodeStore } from "../opencode";
import { useWorkflowStore } from "../workflow";
import type { WorkflowGenState, WorkflowEnhancementSuggestion } from "./types";
import { fetchProjectContext } from "./project-context";
import { fetchAiExamples } from "./examples-generator";
import { fetchSuggestions } from "./suggestions-generator";
import { generate } from "./workflow-generator";

// Re-export types for consumers
export type {
  WorkflowGenStatus,
  WorkflowGenState,
  WorkflowGenMode,
  SuggestionsStatus,
  WorkflowEnhancementSuggestion,
} from "./types";

// ── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowGenStore = create<WorkflowGenState>((set, get) => ({
  // State

  floating: false,
  collapsed: false,
  status: "idle",
  mode: "generate",
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

  // Suggest Enhancements ──
  suggestionsOpen: false,
  suggestionsStatus: "idle",
  suggestions: [],
  suggestionsError: null,
  _suggestionsSessionId: null,
  _suggestionsAbortController: null,

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
  setMode: (mode) => set({ mode }),

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
  fetchSuggestions: () => fetchSuggestions(set, get),

  // Suggest Enhancements Actions

  openSuggestions: () => {
    // Auto-select first model if none is currently selected
    const currentModel = get().selectedModel;
    if (!currentModel) {
      const modelGroups = useOpenCodeStore.getState().modelGroups;
      const firstModel = modelGroups[0]?.models[0]?.value ?? null;
      if (firstModel) {
        set({ selectedModel: firstModel });
      }
    }

    // Open + expand the Nexus AI panel so the inline section is visible
    set({ suggestionsOpen: true, floating: true, collapsed: false });

    const status = get().suggestionsStatus;
    if (status === "idle" || status === "error") {
      void get().fetchSuggestions();
    }
  },

  closeSuggestions: () => {
    const { suggestionsStatus, _suggestionsAbortController } = get();
    if (suggestionsStatus === "loading") {
      _suggestionsAbortController?.abort();
    }
    set({ suggestionsOpen: false });
  },

  cancelSuggestions: () => {
    const { _suggestionsAbortController } = get();
    _suggestionsAbortController?.abort();
    set({
      suggestionsStatus: "idle",
      _suggestionsAbortController: null,
    });
  },

  resetSuggestions: () => {
    set({
      suggestions: [],
      suggestionsStatus: "idle",
      suggestionsError: null,
    });
  },

  applySuggestion: async (suggestion: WorkflowEnhancementSuggestion) => {
    set({
      suggestionsOpen: false,
      floating: true,
      collapsed: true,
      mode: "edit",
      prompt: `${suggestion.title}\n\n${suggestion.description}`,
    });

    await get().generate();

    const finalStatus = get().status;
    if (finalStatus === "done") {
      toast.success("Enhancement applied");
    } else if (finalStatus === "error") {
      toast.error(get().error ?? "Failed to apply enhancement");
    }
  },

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
    const {
      sessionId,
      _abortController,
      _examplesSessionId,
      _examplesAbortController,
      _suggestionsSessionId,
      _suggestionsAbortController,
    } = get();
    _abortController?.abort();
    _examplesAbortController?.abort();
    _suggestionsAbortController?.abort();

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
      if (_suggestionsSessionId) {
        try {
          await client.sessions.abort(_suggestionsSessionId).catch(() => {});
          await client.sessions.delete(_suggestionsSessionId).catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    set({
      sessionId: null,
      status: "idle",
      mode: "generate",
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
      suggestionsOpen: false,
      suggestionsStatus: "idle",
      suggestions: [],
      suggestionsError: null,
      _suggestionsSessionId: null,
      _suggestionsAbortController: null,
    });
  },
}));


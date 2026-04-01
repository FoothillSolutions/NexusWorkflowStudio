// ─── AI Prompt Generation Session Store ─────────────────────────────────────
// Manages per-workflow sessions for AI-powered prompt generation/editing.
// Each workflow gets a dedicated session on the OpenCode server.
// Sessions are disposed when loading/resetting workflows.

import { create } from "zustand";
import { useOpenCodeStore } from "../opencode";
import { useWorkflowStore } from "../workflow";
import {
  buildEditUserMessage,
  buildGenerateUserMessage,
  buildSystemMessage,
} from "./helpers";
import { runPromptGenRequest } from "./runner";
import type {
  PromptGenMode,
  PromptGenState,
  PromptGenView,
} from "./types";

export type {
  EditPayload,
  GeneratePayload,
  PromptGenMode,
  PromptGenNodeType,
  PromptGenState,
  PromptGenStatus,
  PromptGenTemplateFields,
  PromptGenView,
} from "./types";

// ── Store ────────────────────────────────────────────────────────────────────

export const usePromptGenStore = create<PromptGenState>((set, get) => ({
  sessionId: null,
  status: "idle",
  generatedText: "",
  generatedTokens: 0,
  error: null,
  _abortController: null,
  _formSetValue: null,

  // ── Panel UI state ──
  view: "closed" as PromptGenView,
  mode: "freeform" as PromptGenMode,
  freeformText: "",
  editInstruction: "",
  fields: {},
  expandedSections: new Set<string>(),
  targetNodeId: null,
  targetNodeType: null,
  targetPrompt: "",
  floating: false,
  collapsed: false,

  open: (nodeId, currentPrompt, view, nodeType) => {
    set({
      view,
      targetNodeId: nodeId,
      targetNodeType: nodeType ?? "agent",
      targetPrompt: currentPrompt,
      floating: false,
      collapsed: false,
      status: "idle",
      generatedText: "",
      generatedTokens: 0,
      error: null,
    });
  },

  close: () => {
    const { status, _abortController } = get();
    if (status === "streaming" || status === "generating" || status === "creating-session") {
      _abortController?.abort();
      const client = useOpenCodeStore.getState().client;
      const sid = get().sessionId;
      if (client && sid) client.sessions.abort(sid).catch(() => {});
    }
    set({
      view: "closed",
      floating: false,
      collapsed: false,
      status: "idle",
      generatedText: "",
      generatedTokens: 0,
      error: null,
      _abortController: null,
      freeformText: "",
      editInstruction: "",
      fields: {},
      expandedSections: new Set<string>(),
    });
  },

  setView: (view) => set({ view }),
  setMode: (mode) => set({ mode }),
  setFreeformText: (text) => set({ freeformText: text }),
  setEditInstruction: (text) => set({ editInstruction: text }),
  updateField: (key, value) => set((s) => ({ fields: { ...s.fields, [key]: value } })),
  toggleSection: (key) => set((s) => {
    const next = new Set(s.expandedSections);
    if (next.has(key)) next.delete(key); else next.add(key);
    return { expandedSections: next };
  }),
  undock: () => set({ floating: true, collapsed: false }),
  dock: () => set({ floating: false, collapsed: false }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setTargetPrompt: (prompt) => set({ targetPrompt: prompt }),
  registerFormSetValue: (sv) => set({ _formSetValue: sv }),

  applyResult: () => {
    const { generatedText, _formSetValue, targetNodeId } = get();
    if (!generatedText.trim()) return;

    // Use the form's setValue (updates react-hook-form → triggers watchedValues → workflow store sync)
    if (_formSetValue) {
      _formSetValue("promptText" as never, generatedText as never, { shouldDirty: true });
    } else if (targetNodeId) {
      // Fallback: when floating/undocked and the properties panel is closed,
      // _formSetValue is null. Update the workflow store node data directly.
      const ws = useWorkflowStore.getState();
      const inMain = ws.nodes.some((n: { id: string }) => n.id === targetNodeId);
      const inSub = !inMain && ws.subWorkflowNodes.some((n: { id: string }) => n.id === targetNodeId);
      if (inMain) {
        ws.updateNodeData(targetNodeId, { promptText: generatedText } as never);
      } else if (inSub) {
        ws.updateSubNodeData(targetNodeId, { promptText: generatedText } as never);
      }
    }

    set({
      status: "idle",
      generatedText: "",
      generatedTokens: 0,
      error: null,
      view: "closed",
      floating: false,
      collapsed: false,
      freeformText: "",
      editInstruction: "",
      fields: {},
      expandedSections: new Set<string>(),
    });
  },

  ensureSession: async () => {
    const { sessionId } = get();
    if (sessionId) return sessionId;

    const client = useOpenCodeStore.getState().client;
    if (!client) {
      set({ error: "Not connected to OpenCode server", status: "error" });
      return null;
    }

    set({ status: "creating-session" });
    try {
      const session = await client.sessions.create({ title: "Nexus Prompt Generator" });
      set({ sessionId: session.id, status: "idle" });
      return session.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      set({ error: msg, status: "error" });
      return null;
    }
  },

  generate: async (payload) => {
    const store = get();
    const client = useOpenCodeStore.getState().client;
    if (!client) {
      set({ error: "Not connected to OpenCode server", status: "error" });
      return;
    }

    // Cancel any in-progress generation
    store._abortController?.abort();

    const sid = await get().ensureSession();
    if (!sid) return;

    const abortController = new AbortController();
    set({ status: "streaming", generatedText: "", generatedTokens: 0, error: null, _abortController: abortController });

    const result = await runPromptGenRequest({
      client,
      sessionId: sid,
      request: {
        parts: [{ type: "text", text: buildGenerateUserMessage(payload) }],
        model: { providerID: payload.providerId, modelID: payload.modelId },
        system: buildSystemMessage(payload.nodeType),
      },
      signal: abortController.signal,
      onText: (text, tokenEstimate) => {
        set({ generatedText: text, generatedTokens: tokenEstimate });
      },
    });

    if (result.aborted) {
      set({ status: "idle", _abortController: null });
      return;
    }

    if (result.error) {
      set({ error: result.error, status: "error", _abortController: null });
      return;
    }

    set({ status: "done" });
  },

  editWithAi: async (payload) => {
    const store = get();
    const client = useOpenCodeStore.getState().client;
    if (!client) {
      set({ error: "Not connected to OpenCode server", status: "error" });
      return;
    }

    store._abortController?.abort();

    const sid = await get().ensureSession();
    if (!sid) return;

    const abortController = new AbortController();
    set({ status: "streaming", generatedText: "", generatedTokens: 0, error: null, _abortController: abortController });

    const result = await runPromptGenRequest({
      client,
      sessionId: sid,
      request: {
        parts: [{ type: "text", text: buildEditUserMessage(payload) }],
        model: { providerID: payload.providerId, modelID: payload.modelId },
        system: buildSystemMessage(payload.nodeType),
      },
      signal: abortController.signal,
      onText: (text, tokenEstimate) => {
        set({ generatedText: text, generatedTokens: tokenEstimate });
      },
    });

    if (result.aborted) {
      set({ status: "idle", _abortController: null });
      return;
    }

    if (result.error) {
      set({ error: result.error, status: "error", _abortController: null });
      return;
    }

    set({ status: "done" });
  },

  cancel: () => {
    const { _abortController, sessionId } = get();
    _abortController?.abort();

    // Also try to abort the session server-side
    const client = useOpenCodeStore.getState().client;
    if (client && sessionId) {
      client.sessions.abort(sessionId).catch(() => {});
    }

    set({ status: "idle", _abortController: null });
  },

  disposeSession: async () => {
    const { sessionId, _abortController } = get();
    _abortController?.abort();

    if (sessionId) {
      const client = useOpenCodeStore.getState().client;
      if (client) {
        try {
          await client.sessions.abort(sessionId).catch(() => {});
          await client.sessions.delete(sessionId).catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    set({
      sessionId: null,
      status: "idle",
      generatedText: "",
      generatedTokens: 0,
      error: null,
      _abortController: null,
      _formSetValue: null,
      view: "closed",
      floating: false,
      collapsed: false,
      targetNodeId: null,
      targetNodeType: null,
      targetPrompt: "",
      editInstruction: "",
      fields: {},
      expandedSections: new Set<string>(),
    });
  },

  resetState: () => {
    set({ status: "idle", generatedText: "", generatedTokens: 0, error: null });
  },
}));




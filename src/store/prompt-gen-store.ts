// ─── AI Prompt Generation Session Store ─────────────────────────────────────
// Manages per-workflow sessions for AI-powered prompt generation/editing.
// Each workflow gets a dedicated session on the OpenCode server.
// Sessions are disposed when loading/resetting workflows.

import { create } from "zustand";
import { useOpenCodeStore } from "./opencode-store";
import type { Part } from "@/lib/opencode";
import type { FormSetValue } from "@/nodes/shared/form-types";

export type PromptGenStatus = "idle" | "creating-session" | "generating" | "streaming" | "done" | "error";
export type PromptGenView = "closed" | "generate" | "edit";
export type PromptGenMode = "structured" | "freeform";

interface PromptGenState {
  /** The active OpenCode session for prompt generation */
  sessionId: string | null;
  /** Current generation status */
  status: PromptGenStatus;
  /** Generated/streamed text so far */
  generatedText: string;
  /** Estimated token count for the generated text */
  generatedTokens: number;
  /** Error message if status is "error" */
  error: string | null;
  /** AbortController for the SSE stream */
  _abortController: AbortController | null;
  /** Reference to the properties panel form's setValue (for applying results) */
  _formSetValue: FormSetValue | null;

  // ── Panel UI state (persists across properties panel close) ──
  /** Current panel view */
  view: PromptGenView;
  /** Freeform vs structured mode */
  mode: PromptGenMode;
  /** Freeform description text */
  freeformText: string;
  /** Edit-with-AI instruction text */
  editInstruction: string;
  /** Template section fields */
  fields: PromptGenTemplateFields;
  /** Which template sections are expanded */
  expandedSections: Set<string>;
  /** The node ID + current prompt text this generator is targeting */
  targetNodeId: string | null;
  targetPrompt: string;
  /** Whether the panel is undocked/floating (vs inline in properties panel) */
  floating: boolean;
  /** Whether the floating panel body is collapsed */
  collapsed: boolean;

  /** Open the generator for a specific node */
  open: (nodeId: string, currentPrompt: string, view: PromptGenView) => void;
  /** Close the generator panel */
  close: () => void;
  /** Set the panel view */
  setView: (view: PromptGenView) => void;
  /** Set freeform vs structured mode */
  setMode: (mode: PromptGenMode) => void;
  /** Set freeform text */
  setFreeformText: (text: string) => void;
  /** Set edit instruction */
  setEditInstruction: (text: string) => void;
  /** Update a template field */
  updateField: (key: keyof PromptGenTemplateFields, value: string) => void;
  /** Toggle a template section's expanded state */
  toggleSection: (key: string) => void;
  /** Undock from properties panel into floating mode */
  undock: () => void;
  /** Dock back into properties panel from floating mode */
  dock: () => void;
  /** Toggle collapsed state of floating panel */
  toggleCollapsed: () => void;
  /** Update target prompt (keeps it in sync when the prompt field changes) */
  setTargetPrompt: (prompt: string) => void;
  /** Register / unregister the form's setValue function */
  registerFormSetValue: (sv: FormSetValue | null) => void;
  /** Apply the generated text to the prompt field */
  applyResult: () => void;

  /** Create a new session for prompt generation */
  ensureSession: () => Promise<string | null>;
  /** Generate a prompt from template fields */
  generate: (payload: GeneratePayload) => Promise<void>;
  /** Edit an existing prompt with AI */
  editWithAi: (payload: EditPayload) => Promise<void>;
  /** Cancel an in-progress generation */
  cancel: () => void;
  /** Dispose the current session (called on workflow switch/reset) */
  disposeSession: () => Promise<void>;
  /** Reset to idle state (e.g. after applying result) */
  resetState: () => void;
}

export interface PromptGenTemplateFields {
  title?: string;
  purpose?: string;
  variables?: string;
  instructions?: string;
  relevantFiles?: string;
  codebaseStructure?: string;
  workflow?: string;
  template?: string;
  examples?: string;
}

export interface GeneratePayload {
  fields: PromptGenTemplateFields;
  modelId: string;
  providerId: string;
  /** "structured" uses template sections; "freeform" uses a plain description */
  mode: "structured" | "freeform";
  /** For freeform mode: a plain description of the desired prompt */
  freeformDescription?: string;
}

export interface EditPayload {
  currentPrompt: string;
  editInstruction: string;
  modelId: string;
  providerId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The canonical template that every generated prompt should follow. */
const PROMPT_TEMPLATE = `
### **Title**
\`[Verb] [Object] [Context]\`

### **Purpose**
**What it does:** [1–2 sentences: high-level function]
**Why it exists:** [1 sentence: business/user value]
**Success criteria:** [Bullets: measurable outcomes]

### **Variables**
**Dynamic inputs (positional):** $1, $2, $3 = [meaning]
**Static/config values (named):** {{agent_name}}, {{owner}}, {{default_timezone}}, {{source_system}}
**Derived values (computed by agent):** {{start_date}}, {{end_date}} = [rule to compute]

### **Instructions**
**Primary rules (must follow):** [Non-negotiable rules]
**Constraints (do not do these):** [Forbidden actions]
**Edge cases & handling:** [If X is missing → default behavior, if input is ambiguous → fallback]
**Guardrails (safety/quality):** Validate assumptions, prefer deterministic steps, log decisions.

### **Relevant Files**
**Required inputs:** paths/patterns
**Optional references:** README, examples
**File patterns to search:** globs

### **Codebase Structure**
**Top-level layout:** src/, configs/, docs/, tests/, scripts/
**Where to make changes:** Feature logic, interfaces, shared utilities, tests

### **Workflow**
1. Parse inputs → 2. Validate → 3. Collect dependencies → 4. Process → 5. Verify → 6. Produce output → 7. Finish
**Control-flow branches:** MissingFile, VerificationFailure, NoResults

### **Template**
Standard boilerplate: state what you will do, do it, state what happened, include assumptions.

### **Examples**
Example 1 — Basic usage: input → expected behavior
Example 2 — Missing optional input: input → default fallback
Example 3 — Edge case: invalid input → error + accepted formats
`.trim();

function buildSystemMessage(): string {
  return `You are an expert AI prompt engineer. Your task is to generate high-quality, structured agent prompts for workflow automation systems.

Below is the reference template. **Every section is optional.** Only include the sections that are relevant and useful for the specific agent being described — skip any section that does not add value. Do NOT pad the output with empty or generic sections just to fill the template.

${PROMPT_TEMPLATE}

Rules:
- Write in a direct, imperative style
- Be specific and unambiguous
- Include edge case handling when relevant
- Use $1, $2, $3 for dynamic positional parameters
- Use {{variable_name}} for static/config values
- Structure the output logically following the template sections above
- **Only include sections that are needed** — a simple agent may only need Title, Purpose, and Instructions; a complex one may use all sections
- Do NOT wrap the entire output in a code block — output raw Markdown directly
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output`;
}

function buildGenerateUserMessage(payload: GeneratePayload): string {
  const sections: string[] = [];
  const f = payload.fields;

  if (f.title?.trim()) sections.push(`## Title\n${f.title.trim()}`);
  if (f.purpose?.trim()) sections.push(`## Purpose\n${f.purpose.trim()}`);
  if (f.variables?.trim()) sections.push(`## Variables\n${f.variables.trim()}`);
  if (f.instructions?.trim()) sections.push(`## Instructions\n${f.instructions.trim()}`);
  if (f.relevantFiles?.trim()) sections.push(`## Relevant Files\n${f.relevantFiles.trim()}`);
  if (f.codebaseStructure?.trim()) sections.push(`## Codebase Structure\n${f.codebaseStructure.trim()}`);
  if (f.workflow?.trim()) sections.push(`## Workflow\n${f.workflow.trim()}`);
  if (f.template?.trim()) sections.push(`## Template\n${f.template.trim()}`);
  if (f.examples?.trim()) sections.push(`## Examples\n${f.examples.trim()}`);

  const hasFields = sections.length > 0;
  const hasFreeform = payload.mode === "freeform" && payload.freeformDescription?.trim();

  // Both freeform description + structured fields filled
  if (hasFreeform && hasFields) {
    return `Generate a comprehensive agent prompt following the template structure from your system instructions.

Here is a high-level description of what the agent should do:
${payload.freeformDescription!.trim()}

And here are the specific details the user has provided for the template sections:

${sections.join("\n\n")}

Use both the description and the structured sections to produce the final prompt. Follow the template format.`;
  }

  // Freeform only — still generate using the template
  if (hasFreeform) {
    return `Generate a comprehensive agent prompt following the template structure from your system instructions.

Here is a description of what the agent should do:
${payload.freeformDescription!.trim()}

Infer which template sections are relevant from this description and fill only those in with concrete, actionable content. Skip any sections that don't apply.`;
  }

  // Structured fields only
  if (hasFields) {
    return `Generate a comprehensive agent prompt following the template structure from your system instructions.

Here are the details the user has provided:

${sections.join("\n\n")}

Use these to produce the final prompt. You may add other template sections only if they can be clearly inferred from the input — otherwise leave them out.`;
  }

  // Nothing filled — general-purpose
  return `Generate a general-purpose agent prompt template following the template structure from your system instructions. Fill each section with realistic placeholder content that demonstrates how the template should be used.`;
}

function buildEditUserMessage(payload: EditPayload): string {
  return `Here is the current agent prompt:

---
${payload.currentPrompt}
---

Please modify this prompt according to the following instruction:
${payload.editInstruction}

Keep the output in the same template structure. If the edit adds new concerns, slot them into the appropriate template section (Title, Purpose, Variables, Instructions, Workflow, etc.).`;
}

/** Extract text from assistant message parts */
function extractTextFromParts(parts: Part[]): string {
  return parts
    .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** Rough token estimate (~4 chars per token for English text) */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

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
  targetPrompt: "",
  floating: false,
  collapsed: false,

  open: (nodeId, currentPrompt, view) => {
    set({
      view,
      targetNodeId: nodeId,
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
    const { generatedText, _formSetValue } = get();
    if (!generatedText.trim()) return;

    // Use the form's setValue (updates react-hook-form → triggers watchedValues → workflow store sync)
    if (_formSetValue) {
      _formSetValue("promptText" as never, generatedText as never, { shouldDirty: true });
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

    try {
      // Send prompt async then stream events
      await client.messages.sendAsync(sid, {
        parts: [{ type: "text", text: buildGenerateUserMessage(payload) }],
        model: { providerID: payload.providerId, modelID: payload.modelId },
        system: buildSystemMessage(),
      }, { signal: abortController.signal });

      // Stream SSE events to get real-time text
      let fullText = "";
      for await (const event of client.events.subscribe({ signal: abortController.signal })) {
        if (abortController.signal.aborted) break;

        if (event.type === "message.part.delta") {
          const props = event.properties as { sessionID: string; field: string; delta: string };
          if (props.sessionID === sid && props.field === "text") {
            fullText += props.delta;
            set({ generatedText: fullText, generatedTokens: estimateTokens(fullText) });
          }
        } else if (event.type === "session.idle") {
          const props = event.properties as { sessionID: string };
          if (props.sessionID === sid) {
            break;
          }
        } else if (event.type === "session.error") {
          const props = event.properties as { sessionID?: string; error?: { name: string; data?: { message?: string } } };
          if (props.sessionID === sid) {
            set({ error: props.error?.data?.message ?? "Generation failed", status: "error" });
            return;
          }
        }
      }

      // If streaming produced nothing, fall back to fetching the last message
      if (!fullText.trim()) {
        const messages = await client.messages.list(sid, 2);
        const assistantMsg = messages.find((m) => m.info.role === "assistant");
        if (assistantMsg) {
          fullText = extractTextFromParts(assistantMsg.parts);
          set({ generatedText: fullText, generatedTokens: estimateTokens(fullText) });
        }
      }

      set({ status: "done" });
    } catch (err) {
      if (abortController.signal.aborted) {
        set({ status: "idle", _abortController: null });
        return;
      }
      const msg = err instanceof Error ? err.message : "Generation failed";
      set({ error: msg, status: "error", _abortController: null });
    }
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

    try {
      await client.messages.sendAsync(sid, {
        parts: [{ type: "text", text: buildEditUserMessage(payload) }],
        model: { providerID: payload.providerId, modelID: payload.modelId },
        system: buildSystemMessage(),
      }, { signal: abortController.signal });

      let fullText = "";
      for await (const event of client.events.subscribe({ signal: abortController.signal })) {
        if (abortController.signal.aborted) break;

        if (event.type === "message.part.delta") {
          const props = event.properties as { sessionID: string; field: string; delta: string };
          if (props.sessionID === sid && props.field === "text") {
            fullText += props.delta;
            set({ generatedText: fullText, generatedTokens: estimateTokens(fullText) });
          }
        } else if (event.type === "session.idle") {
          const props = event.properties as { sessionID: string };
          if (props.sessionID === sid) break;
        } else if (event.type === "session.error") {
          const props = event.properties as { sessionID?: string; error?: { name: string; data?: { message?: string } } };
          if (props.sessionID === sid) {
            set({ error: props.error?.data?.message ?? "Edit failed", status: "error" });
            return;
          }
        }
      }

      if (!fullText.trim()) {
        const messages = await client.messages.list(sid, 2);
        const assistantMsg = messages.find((m) => m.info.role === "assistant");
        if (assistantMsg) {
          fullText = extractTextFromParts(assistantMsg.parts);
          set({ generatedText: fullText, generatedTokens: estimateTokens(fullText) });
        }
      }

      set({ status: "done" });
    } catch (err) {
      if (abortController.signal.aborted) {
        set({ status: "idle", _abortController: null });
        return;
      }
      const msg = err instanceof Error ? err.message : "Edit failed";
      set({ error: msg, status: "error", _abortController: null });
    }
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
      targetPrompt: "",
      freeformText: "",
      editInstruction: "",
      fields: {},
      expandedSections: new Set<string>(),
    });
  },

  resetState: () => {
    set({ status: "idle", generatedText: "", generatedTokens: 0, error: null });
  },
}));


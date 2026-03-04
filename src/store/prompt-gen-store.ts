// ─── AI Prompt Generation Session Store ─────────────────────────────────────
// Manages per-workflow sessions for AI-powered prompt generation/editing.
// Each workflow gets a dedicated session on the OpenCode server.
// Sessions are disposed when loading/resetting workflows.

import { create } from "zustand";
import { useOpenCodeStore } from "./opencode-store";
import { useWorkflowStore } from "./workflow-store";
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
  targetNodeType: "agent" | "prompt" | null;
  targetPrompt: string;
  /** Whether the panel is undocked/floating (vs inline in properties panel) */
  floating: boolean;
  /** Whether the floating panel body is collapsed */
  collapsed: boolean;

  /** Open the generator for a specific node */
  open: (nodeId: string, currentPrompt: string, view: PromptGenView, nodeType?: "agent" | "prompt") => void;
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
  /** Names of connected skills and documents so the AI can reference them */
  connectedResourceNames?: { skills: string[]; docs: string[] };
  /** The type of node being targeted — affects system prompt style */
  nodeType?: "agent" | "prompt";
}

export interface EditPayload {
  currentPrompt: string;
  editInstruction: string;
  modelId: string;
  providerId: string;
  /** Names of connected skills and documents so the AI can reference them */
  connectedResourceNames?: { skills: string[]; docs: string[] };
  /** The type of node being targeted — affects system prompt style */
  nodeType?: "agent" | "prompt";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Markdown snippet listing connected skills & docs (empty string if none). */
function buildConnectedResourcesBlock(res?: { skills: string[]; docs: string[] }): string {
  if (!res) return "";
  const lines: string[] = [];
  if (res.skills.length > 0) {
    lines.push("**Connected Skills:**");
    for (const s of res.skills) lines.push(`- {{${s}}}`);
  }
  if (res.docs.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Connected Documents:**");
    for (const d of res.docs) lines.push(`- {{${d}}}`);
  }
  return lines.length > 0 ? lines.join("\n") : "";
}

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

function buildSystemMessage(nodeType?: "agent" | "prompt"): string {
  if (nodeType === "prompt") {
    return `You are a prompt-text generator. You receive a description of a prompt and you output **only the prompt text** — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the prompt text itself. No preamble, no "Here is the prompt:", no explanation, no plan, no commentary before or after.
- Output raw Markdown directly. Do NOT wrap the output in a code block.
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output.
- Write clear, well-structured prompt text. Use sections, bullet points, and formatting as appropriate for the content.
- Use $1, $2, $3 for dynamic positional parameters when the user mentions inputs
- Use {{variable_name}} for static/config values
- You do NOT need to follow any specific template structure — let the content dictate the format
- Keep the prompt focused, practical, and directly usable`;
  }

  return `You are a prompt-text generator. You receive a description of an agent and you output **only the prompt text** that will be assigned to that agent — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the prompt text itself. No preamble, no "Here is the prompt:", no explanation, no plan, no steps to build anything, no commentary before or after.
- Do NOT create a plan. Do NOT describe how to build the agent. Do NOT list implementation steps.
- You are writing THE PROMPT that the agent will receive as its system instructions.
- Output raw Markdown directly. Do NOT wrap the output in a code block.
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output.

Use the following reference template structure. **Every section is optional.** Only include sections that are relevant — skip any that do not add value.

${PROMPT_TEMPLATE}

Style rules:
- Write in a direct, imperative style addressed to the agent (e.g. "You are a…", "Your task is to…")
- Be specific and unambiguous
- Include edge case handling when relevant
- Use $1, $2, $3 for dynamic positional parameters
- Use {{variable_name}} for static/config values
- **Only include sections that are needed** — a simple agent may only need Title, Purpose, and Instructions
- When the user provides connected skills or documents, reference them using the exact {{name}} syntax as given`;
}

function buildGenerateUserMessage(payload: GeneratePayload): string {
  const isPromptNode = payload.nodeType === "prompt";
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

  // Build connected-resources context (may be empty)
  const resBlock = buildConnectedResourcesBlock(payload.connectedResourceNames);
  const resSection = resBlock
    ? `\n\n## Connected Resources\nThe ${isPromptNode ? "prompt" : "agent"} has the following skills and documents connected to it. Reference them in the prompt using the exact {{name}} syntax shown below:\n\n${resBlock}`
    : "";

  if (isPromptNode) {
    // ── Prompt node messages ──
    if (hasFreeform && hasFields) {
      return `Write prompt text based on this description:
${payload.freeformDescription!.trim()}

Additional details:

${sections.join("\n\n")}${resSection}

Remember: output ONLY the prompt text. No plan, no explanation. Structure the output naturally based on the content — no need to follow a rigid template.`;
    }

    if (hasFreeform) {
      return `Write prompt text based on this description:
${payload.freeformDescription!.trim()}${resSection}

Output ONLY the prompt text. Structure it naturally — use sections, bullets, or plain prose as appropriate for the content. Do not follow a rigid template.`;
    }

    if (hasFields) {
      return `Write prompt text using these details:

${sections.join("\n\n")}${resSection}

You may add additional content only if clearly inferred from the input. Output ONLY the prompt text.`;
    }

    return `Write a well-structured, general-purpose prompt template. Fill each section with realistic content that demonstrates good prompt writing. Output ONLY the prompt text.${resSection}`;
  }

  // ── Agent node messages (original behavior) ──

  // Both freeform description + structured fields filled
  if (hasFreeform && hasFields) {
    return `Write the agent prompt text for an agent described as:
${payload.freeformDescription!.trim()}

Additional details for the template sections:

${sections.join("\n\n")}${resSection}

Remember: output ONLY the prompt text. No plan, no explanation.`;
  }

  // Freeform only — still generate using the template
  if (hasFreeform) {
    return `Write the agent prompt text for an agent described as:
${payload.freeformDescription!.trim()}${resSection}

Infer which template sections are relevant and fill only those with concrete content. Skip sections that don't apply. Output ONLY the prompt text.`;
  }

  // Structured fields only
  if (hasFields) {
    return `Write the agent prompt text using these details:

${sections.join("\n\n")}${resSection}

You may add other template sections only if clearly inferred from the input. Output ONLY the prompt text.`;
  }

  // Nothing filled — general-purpose
  return `Write a general-purpose agent prompt template following the template structure. Fill each section with realistic content that demonstrates how the template should be used. Output ONLY the prompt text.${resSection}`;
}

function buildEditUserMessage(payload: EditPayload): string {
  const isPromptNode = payload.nodeType === "prompt";
  const resBlock = buildConnectedResourcesBlock(payload.connectedResourceNames);
  const resSection = resBlock
    ? `\n\nThe ${isPromptNode ? "prompt" : "agent"} has the following skills and documents connected — reference them using the exact {{name}} syntax:\n\n${resBlock}`
    : "";

  return `Here is the current ${isPromptNode ? "prompt" : "agent prompt"}:

---
${payload.currentPrompt}
---

Modify this prompt according to the following instruction:
${payload.editInstruction}${resSection}

${isPromptNode ? "Keep a clear structure." : "Keep the same template structure."} Output ONLY the modified prompt text — no explanation, no commentary.`;
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

    try {
      // Send prompt async then stream events
      await client.messages.sendAsync(sid, {
        parts: [{ type: "text", text: buildGenerateUserMessage(payload) }],
        model: { providerID: payload.providerId, modelID: payload.modelId },
        system: buildSystemMessage(payload.nodeType),
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
        system: buildSystemMessage(payload.nodeType),
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


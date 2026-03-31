// ─── AI Prompt Generation Session Store ─────────────────────────────────────
// Manages per-workflow sessions for AI-powered prompt generation/editing.
// Each workflow gets a dedicated session on the OpenCode server.
// Sessions are disposed when loading/resetting workflows.

import { create } from "zustand";
import { useOpenCodeStore } from "./opencode-store";
import { useWorkflowStore } from "./workflow-store";
import type { Part } from "@/lib/opencode";
import type { FormSetValue } from "@/nodes/shared/form-types";
import { runPromptGenRequest } from "./prompt-gen-runner";
import type {
// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Markdown snippet listing connected skills & docs (empty string if none). */
function buildConnectedResourcesBlock(res?: { skills: string[]; docs: string[]; scripts: string[] }): string {
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
  if (res.scripts.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Connected Scripts:**");
    for (const s of res.scripts) lines.push(`- {{${s}}}`);
  }
  return lines.length > 0 ? lines.join("\n") : "";
}

function buildConnectedResourceGuidance(
  nodeType: PromptGenNodeType,
  res?: { skills: string[]; docs: string[]; scripts: string[] },
): string {
  if (!res) return "";

  const lines: string[] = [];

  if (nodeType === "agent") {
    if (res.skills.length > 0) {
      lines.push("- Connected skills are reusable capability modules. Reference them with the exact `{{skill-name}}` syntax and explain when the agent should rely on each skill.");
    }
    if (res.docs.length > 0) {
      lines.push("- Connected documents are reference sources. Reference them with the exact `{{doc-name.ext}}` or provided `{{name}}` syntax when the agent should consult them.");
    }
  }

  if (nodeType === "skill" && res.scripts.length > 0) {
    lines.push("- Connected scripts are runnable Bun helpers attached to this skill. Refer to them with the exact `{{script-name}}` syntax when the skill should call or recommend a helper script.");
    lines.push("- Describe what each referenced script is for, when to run it, what inputs it expects, and what output/result the agent should use.");
    lines.push("- Do not inline the full script source into the skill prompt. Treat scripts as external runnable helpers documented by the skill.");
  }

  if (nodeType === "script") {
    lines.push("- If workflow context shows this script is attached to a skill, write the script as a focused helper that supports that skill's workflow directly.");
    lines.push("- Prefer Bun-compatible TypeScript/JavaScript with a clear entrypoint, explicit inputs, and useful console output or return data.");
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

/** Format a single node summary as a concise Markdown bullet. */
function formatNodeSummary(n: NodeSummary): string {
  const parts: string[] = [`- **[${n.type}]** "${n.label || n.name}"`];
  if (n.description) parts.push(`  — ${n.description}`);
  if (n.promptText) parts.push(`  Prompt excerpt: ${n.promptText}`);
  if (n.branches && n.branches.length > 0) parts.push(`  Branches: ${n.branches.join("; ")}`);
  return parts.join("\n");
}

/** Build a Markdown snippet describing upstream/downstream workflow neighbours (empty string if none). */
function buildConnectedNodeContextBlock(ctx?: ConnectedNodeContext): string {
  if (!ctx) return "";
  const { upstream, downstream } = ctx;
  if (upstream.length === 0 && downstream.length === 0) return "";

  const lines: string[] = [];
  if (upstream.length > 0) {
    lines.push("**Upstream Nodes (execute before this node):**");
    for (const n of upstream) lines.push(formatNodeSummary(n));
  }
  if (downstream.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Downstream Nodes (execute after this node):**");
    for (const n of downstream) lines.push(formatNodeSummary(n));
  }
  return lines.join("\n");
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

function buildSystemMessage(nodeType?: PromptGenNodeType): string {
  if (nodeType === "script") {
    return `You are a Bun script generator. You receive a description of a script node and output only the executable script source code — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the script source code itself. No preamble, no explanation, no code fences.
- Output runnable JavaScript or TypeScript that Bun can execute directly.
- Prefer clear, production-ready code with sensible imports, async handling, and small comments only when they add real value.
- Use {{variable_name}} for static/config values when the script should reference connected resources by name.
- If the script needs inputs, it may read Bun arguments from process.argv or Bun.argv as appropriate.
- When workflow context shows the script belongs to a skill, make it a purpose-built helper for that skill rather than a generic standalone utility.
- When workflow context is provided, write the script so it fits naturally with the surrounding workflow and skill behavior.`;
  }

  if (nodeType === "skill") {
    return `You are a skill-prompt generator. A "skill" is a reusable instruction block that teaches an AI agent **how to do something** — like a procedure, technique, coding pattern, or domain-specific method. You receive a description and output **only the skill prompt text** — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the skill prompt text itself. No preamble, no "Here is the skill:", no explanation, no commentary before or after.
- Output raw Markdown directly. Do NOT wrap the output in a code block.
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output.
- Write the skill as clear, step-by-step instructions that an AI agent can follow.
- Use imperative style: "Do X", "When Y happens, do Z", "Always ensure…"
- Include edge cases, constraints, and quality checks where relevant.
- Use $1, $2, $3 for dynamic positional parameters when the skill takes inputs.
- Use {{variable_name}} for static/config values.
- Structure with sections if the skill is complex, but keep it concise for simple skills.
- Focus on the *how* — the agent already knows *what* to do from its main prompt; the skill teaches the specific technique.
- When connected scripts are provided, reference them using the exact {{script-name}} syntax and explain when/how the agent should run them.
- Treat connected scripts as external Bun helpers; document their usage, expected inputs, and outputs instead of pasting their source code into the skill.
- When workflow context (upstream/downstream nodes) is provided, tailor the skill to fit naturally within the pipeline — consider what data arrives from upstream nodes and what downstream nodes expect.`;
  }

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
- Keep the prompt focused, practical, and directly usable
- When workflow context (upstream/downstream nodes) is provided, consider what precedes and follows this prompt in the pipeline and write content that fits naturally in that flow.`;
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
- When the user provides connected skills or documents, reference them using the exact {{name}} syntax as given
- When connected skills are provided, explain when the agent should use each skill and what kind of work each skill owns
- When workflow context (upstream/downstream nodes) is provided, consider the agent's role in the pipeline — what it receives from upstream and what downstream nodes expect from it. Tailor instructions, edge cases, and workflow steps accordingly.`;
}

function buildGenerateUserMessage(payload: GeneratePayload): string {
  const nodeType = payload.nodeType ?? "agent";
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
  const resGuidance = buildConnectedResourceGuidance(nodeType, payload.connectedResourceNames);
  const nodeLabel = nodeType === "skill" ? "skill" : nodeType === "prompt" ? "prompt" : nodeType === "script" ? "script" : "agent";
  const resSection = resBlock
    ? `\n\n## Connected Resources\nThe ${nodeLabel} has the following connected resources. Reference them in the prompt using the exact {{name}} syntax shown below:\n\n${resBlock}${resGuidance ? `\n\n## Resource Guidance\n${resGuidance}` : ""}`
    : "";

  // Build workflow context section (upstream/downstream neighbours)
  const ctxBlock = buildConnectedNodeContextBlock(payload.connectedNodeContext);
  const ctxSection = ctxBlock
    ? `\n\n## Workflow Context\nThis ${nodeLabel} is part of a larger workflow. Here are the nodes connected before and after it — consider its role in this pipeline:\n\n${ctxBlock}`
    : "";

  if (nodeType === "skill") {
    // ── Skill node messages ──
    if (hasFreeform && hasFields) {
      return `Write the skill prompt text for a skill described as:
${payload.freeformDescription!.trim()}

Additional details:

${sections.join("\n\n")}${resSection}${ctxSection}

Remember: output ONLY the skill prompt text — step-by-step instructions that teach an AI agent how to perform this skill. No plan, no explanation.`;
    }

    if (hasFreeform) {
      return `Write the skill prompt text for a skill described as:
${payload.freeformDescription!.trim()}${resSection}${ctxSection}

Output ONLY the skill prompt text. Write clear, actionable instructions that teach an AI agent how to perform this technique or procedure. Use steps, rules, and examples as appropriate.`;
    }

    if (hasFields) {
      return `Write the skill prompt text using these details:

${sections.join("\n\n")}${resSection}${ctxSection}

You may add additional content only if clearly inferred from the input. Output ONLY the skill prompt text.`;
    }

    return `Write a well-structured skill prompt that teaches an AI agent a useful technique or procedure. Fill in realistic, actionable content. Output ONLY the skill prompt text.${resSection}${ctxSection}`;
  }

  if (nodeType === "script") {
    if (hasFreeform && hasFields) {
      return `Write the Bun script source code for a script described as:
${payload.freeformDescription!.trim()}

Additional details:

${sections.join("\n\n")}${resSection}${ctxSection}

Remember: output ONLY the script source code. No explanation.`;
    }

    if (hasFreeform) {
      return `Write Bun-compatible script source code based on this description:
${payload.freeformDescription!.trim()}${resSection}${ctxSection}

Output ONLY the script source code. No explanation.`;
    }

    if (hasFields) {
      return `Write Bun-compatible script source code using these details:

${sections.join("\n\n")}${resSection}${ctxSection}

Output ONLY the script source code.`;
    }

    return `Write a useful Bun-compatible script template with realistic runnable code. Output ONLY the script source code.${resSection}${ctxSection}`;
  }

  if (nodeType === "prompt") {
    // ── Prompt node messages ──
    if (hasFreeform && hasFields) {
      return `Write prompt text based on this description:
${payload.freeformDescription!.trim()}

Additional details:

${sections.join("\n\n")}${resSection}${ctxSection}

Remember: output ONLY the prompt text. No plan, no explanation. Structure the output naturally based on the content — no need to follow a rigid template.`;
    }

    if (hasFreeform) {
      return `Write prompt text based on this description:
${payload.freeformDescription!.trim()}${resSection}${ctxSection}

Output ONLY the prompt text. Structure it naturally — use sections, bullets, or plain prose as appropriate for the content. Do not follow a rigid template.`;
    }

    if (hasFields) {
      return `Write prompt text using these details:

${sections.join("\n\n")}${resSection}${ctxSection}

You may add additional content only if clearly inferred from the input. Output ONLY the prompt text.`;
    }

    return `Write a well-structured, general-purpose prompt template. Fill each section with realistic content that demonstrates good prompt writing. Output ONLY the prompt text.${resSection}${ctxSection}`;
  }

  // ── Agent node messages (original behavior) ──

  // Both freeform description + structured fields filled
  if (hasFreeform && hasFields) {
    return `Write the agent prompt text for an agent described as:
${payload.freeformDescription!.trim()}

Additional details for the template sections:

${sections.join("\n\n")}${resSection}${ctxSection}

Remember: output ONLY the prompt text. No plan, no explanation.`;
  }

  // Freeform only — still generate using the template
  if (hasFreeform) {
    return `Write the agent prompt text for an agent described as:
${payload.freeformDescription!.trim()}${resSection}${ctxSection}

Infer which template sections are relevant and fill only those with concrete content. Skip sections that don't apply. Output ONLY the prompt text.`;
  }

  // Structured fields only
  if (hasFields) {
    return `Write the agent prompt text using these details:

${sections.join("\n\n")}${resSection}${ctxSection}

You may add other template sections only if clearly inferred from the input. Output ONLY the prompt text.`;
  }

  // Nothing filled — general-purpose
  return `Write a general-purpose agent prompt template following the template structure. Fill each section with realistic content that demonstrates how the template should be used. Output ONLY the prompt text.${resSection}${ctxSection}`;
}

function buildEditUserMessage(payload: EditPayload): string {
  const nodeType = payload.nodeType ?? "agent";
  const nodeLabel = nodeType === "skill" ? "skill" : nodeType === "prompt" ? "prompt" : nodeType === "script" ? "script" : "agent prompt";
  const resBlock = buildConnectedResourcesBlock(payload.connectedResourceNames);
  const resGuidance = buildConnectedResourceGuidance(nodeType, payload.connectedResourceNames);
  const resSection = resBlock
    ? `\n\nThe ${nodeType === "agent" ? "agent" : nodeType} has the following connected resources — reference them using the exact {{name}} syntax:\n\n${resBlock}${resGuidance ? `\n\nResource guidance:\n${resGuidance}` : ""}`
    : "";

  // Workflow context (upstream/downstream neighbours)
  const ctxBlock = buildConnectedNodeContextBlock(payload.connectedNodeContext);
  const ctxSection = ctxBlock
    ? `\n\nThis ${nodeType === "agent" ? "agent" : nodeType} is part of a larger workflow. Here are the nodes that execute before and after it — consider its role in the pipeline when making edits:\n\n${ctxBlock}`
    : "";

  return `Here is the current ${nodeLabel}:

---
${payload.currentPrompt}
---

Modify this ${nodeType === "agent" ? "prompt" : nodeType} according to the following instruction:
${payload.editInstruction}${resSection}${ctxSection}

${nodeType === "agent" ? "Keep the same template structure." : "Keep a clear structure."} Output ONLY the modified ${nodeType === "agent" ? "prompt" : nodeType} text — no explanation, no commentary.`;
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
export type {
  EditPayload,
  GeneratePayload,
  PromptGenMode,
  PromptGenNodeType,
  PromptGenState,
  PromptGenStatus,
  PromptGenTemplateFields,
  PromptGenView,
} from "./prompt-gen-types";

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


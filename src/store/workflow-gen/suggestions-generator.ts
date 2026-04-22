// ─── Workflow Enhancement Suggestions Generator ──────────────────────────────
// Fetches AI-generated enhancement suggestions for the current workflow.

import { useOpenCodeStore } from "../opencode";
import { useWorkflowStore } from "../workflow";
import { WorkflowNodeType, type WorkflowJSON } from "@/types/workflow";
import type { StoreGet, StoreSet, WorkflowEnhancementSuggestion } from "./types";
import { parseSelectedModel } from "./model-utils";

/** Minimum number of suggestions we want from the LLM. */
const MIN_SUGGESTIONS = 3;
/** Maximum number of suggestions to keep from the LLM response. */
const MAX_SUGGESTIONS = 5;

/** System prompt constant used for the suggestions flow. */
const SUGGESTIONS_SYSTEM_PROMPT = `You analyze workflow graphs for Nexus Workflow Studio and output ONLY a valid JSON array of enhancement ideas.

Output format (strict):
[
  {"title": "short actionable title (6-10 words)", "description": "2-3 sentence explanation of the enhancement, what it adds, and why it helps."},
  ...
]

Rules:
- Output ONLY the JSON array. No markdown, no code fences, no explanation before or after.
- Return between ${MIN_SUGGESTIONS} and ${MAX_SUGGESTIONS} suggestions.
- Each suggestion must be self-contained — another AI receiving ONLY the title+description must be able to apply the change unambiguously to the current workflow.
- Favor concrete structural improvements: add missing branches, error handling, validation, parallelism, sub-workflow extraction, better prompts/models, memory/tool tightening, skill/document attachments.
- Do NOT propose suggestions that require new external systems or user-provided secrets.
- Do NOT repeat suggestions.
- Prefer improvements that change at most 2-3 nodes at a time.`;

/** Generate a stable-ish id for each suggestion. */
function newSuggestionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `sug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Strip transient / unimportant fields from a node to reduce prompt tokens. */
function stripTransientNodeData(node: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const data = node.data as Record<string, unknown> | undefined;

  if (typeof node.id === "string") out.id = node.id;
  if (typeof node.type === "string") out.type = node.type;

  if (data && typeof data === "object") {
    const cleanedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "detectedVariables" || key === "color") continue;
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value as Record<string, unknown>).length === 0
      ) {
        continue;
      }
      cleanedData[key] = value;
    }
    out.data = cleanedData;
  }

  return out;
}

/** Serialize the workflow into a compact JSON string for the LLM prompt. */
function serializeWorkflowForPrompt(workflow: WorkflowJSON): string {
  const stripped = {
    name: workflow.name,
    nodes: workflow.nodes.map((n) => stripTransientNodeData(n as unknown as Record<string, unknown>)),
    edges: workflow.edges.map((e) => {
      const edge = e as unknown as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      if (edge.id) out.id = edge.id;
      if (edge.source) out.source = edge.source;
      if (edge.target) out.target = edge.target;
      if (edge.sourceHandle) out.sourceHandle = edge.sourceHandle;
      if (edge.targetHandle) out.targetHandle = edge.targetHandle;
      if (edge.label) out.label = edge.label;
      return out;
    }),
  };
  return JSON.stringify(stripped, null, 2);
}

/** Parse the LLM text into a list of suggestion objects. */
function parseSuggestionsFromText(text: string): WorkflowEnhancementSuggestion[] {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed: unknown = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return [];

  const items: WorkflowEnhancementSuggestion[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    const description = typeof obj.description === "string" ? obj.description.trim() : "";
    if (!title || !description) continue;
    items.push({ id: newSuggestionId(), title, description });
  }

  return items.slice(0, MAX_SUGGESTIONS);
}

/** Fetch AI-generated enhancement suggestions for the current workflow. */
export async function fetchSuggestions(set: StoreSet, get: StoreGet): Promise<void> {
  const { suggestionsStatus, _suggestionsAbortController: prevAc, selectedModel } = get();

  // Early-return if already loading
  if (suggestionsStatus === "loading") return;

  const client = useOpenCodeStore.getState().client;
  if (!client) {
    set({
      suggestionsStatus: "error",
      suggestionsError: "Not connected to OpenCode server. Please connect first.",
      _suggestionsAbortController: null,
    });
    return;
  }

  // Need a model selected
  if (!selectedModel) {
    set({
      suggestionsStatus: "error",
      suggestionsError: "Please select a model before requesting suggestions.",
      _suggestionsAbortController: null,
    });
    return;
  }

  // Validate the current workflow has something to analyze
  const workflow = useWorkflowStore.getState().getWorkflowJSON();
  const meaningfulNodes = workflow.nodes.filter((n) => {
    const t = n.data?.type;
    return t !== WorkflowNodeType.Start && t !== WorkflowNodeType.End;
  });
  if (meaningfulNodes.length === 0) {
    set({
      suggestionsStatus: "error",
      suggestionsError: "Add at least one node to your workflow before requesting suggestions.",
      _suggestionsAbortController: null,
    });
    return;
  }

  prevAc?.abort();
  const abortController = new AbortController();
  set({
    suggestionsStatus: "loading",
    suggestionsError: null,
    suggestions: [],
    _suggestionsAbortController: abortController,
  });

  try {
    // Ensure a session for suggestions
    let sid = get()._suggestionsSessionId;
    if (!sid) {
      const session = await client.sessions.create({ title: "Nexus Enhancement Suggestions" });
      sid = session.id;
      set({ _suggestionsSessionId: sid });
    }

    const parsedModel = parseSelectedModel(selectedModel);
    if (!parsedModel) {
      set({
        suggestionsStatus: "error",
        suggestionsError: "Invalid model selection.",
        _suggestionsAbortController: null,
      });
      return;
    }

    const { providerId, modelId } = parsedModel;

    const serialized = serializeWorkflowForPrompt(workflow);
    const userText = `Here is the current workflow as JSON:\n\n\`\`\`json\n${serialized}\n\`\`\`\n\nSuggest between ${MIN_SUGGESTIONS} and ${MAX_SUGGESTIONS} concrete enhancements. Output ONLY the JSON array.`;

    await client.messages.sendAsync(
      sid,
      {
        parts: [{ type: "text", text: userText }],
        ...(providerId && modelId
          ? { model: { providerID: providerId, modelID: modelId } }
          : {}),
        system: SUGGESTIONS_SYSTEM_PROMPT,
      },
      { signal: abortController.signal },
    );

    // Stream SSE events
    let fullText = "";
    for await (const event of client.events.subscribe({ signal: abortController.signal })) {
      if (abortController.signal.aborted) break;

      if (event.type === "message.part.delta") {
        const props = event.properties as { sessionID: string; field: string; delta: string };
        if (props.sessionID === sid && props.field === "text") {
          fullText += props.delta;
        }
      } else if (event.type === "session.idle") {
        const props = event.properties as { sessionID: string };
        if (props.sessionID === sid) break;
      } else if (event.type === "session.error") {
        const props = event.properties as {
          sessionID?: string;
          error?: { name: string; data?: { message?: string } };
        };
        if (props.sessionID === sid) {
          set({
            suggestionsStatus: "error",
            suggestionsError: props.error?.data?.message ?? "Suggestion generation failed",
            _suggestionsAbortController: null,
          });
          return;
        }
      }
    }

    // Parse the JSON response
    try {
      const items = parseSuggestionsFromText(fullText);
      if (items.length === 0) {
        set({
          suggestionsStatus: "error",
          suggestionsError: "The AI did not return any usable suggestions. Please try again.",
          _suggestionsAbortController: null,
        });
        return;
      }
      set({
        suggestions: items,
        suggestionsStatus: "done",
        suggestionsError: null,
        _suggestionsAbortController: null,
      });
    } catch {
      set({
        suggestionsStatus: "error",
        suggestionsError: "Failed to parse AI response as JSON.",
        _suggestionsAbortController: null,
      });
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      set({ suggestionsStatus: "idle", _suggestionsAbortController: null });
      return;
    }
    const msg = err instanceof Error ? err.message : "Failed to fetch suggestions";
    set({
      suggestionsStatus: "error",
      suggestionsError: msg,
      _suggestionsAbortController: null,
    });
  }
}

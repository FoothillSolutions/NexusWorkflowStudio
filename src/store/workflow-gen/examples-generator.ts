// ─── AI Example Prompts Generator ────────────────────────────────────────────
// Fetches AI-generated example workflow prompts using the connected model.

import { useOpenCodeStore } from "../opencode";
import type { StoreGet, StoreSet } from "./types";
import { parseSelectedModel } from "./model-utils";

/** Number of AI examples requested for the floating workflow generator panel. */
const AI_EXAMPLE_REQUEST_COUNT = 5;

/** Allow slower ACP-backed example generations to complete even when the shared client default is short. */
const AI_EXAMPLES_TIMEOUT_MS = 2 * 60_000;

function extractTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

/** Fetch AI-generated example prompts using the connected model. */
export async function fetchAiExamples(
  set: StoreSet,
  get: StoreGet,
  opts?: { prepend?: boolean },
): Promise<void> {
  const { aiExamplesStatus, _examplesAbortController: prevAc, selectedModel } = get();
  const prepend = opts?.prepend ?? false;

  // When not prepending, skip if already loading or done
  if (!prepend && (aiExamplesStatus === "loading" || aiExamplesStatus === "done")) return;

  const client = useOpenCodeStore.getState().client;
  if (!client) return;

  // Need a model selected
  if (!selectedModel) return;

  prevAc?.abort();
  const abortController = new AbortController();
  set({ aiExamplesStatus: "loading", _examplesAbortController: abortController });

  try {
    // Ensure a session for examples
    let sid = get()._examplesSessionId;
    if (!sid) {
      const session = await client.sessions.create({ title: "Nexus Workflow Examples" });
      sid = session.id;
      set({ _examplesSessionId: sid });
    }

    const parsedModel = parseSelectedModel(selectedModel);
    if (!parsedModel) {
      set({ aiExamplesStatus: "idle", _examplesAbortController: null });
      return;
    }

    const { providerId, modelId } = parsedModel;

    // Send the prompt synchronously so ACP-backed bridges can return the final
    // assistant message even when fast responses finish before the SSE stream is
    // fully attached on the client side.
    const { useProjectContext, projectContext } = get();
    const projectHint = useProjectContext && projectContext
      ? `\n\nThe user is working on a project with this structure — tailor examples to be relevant:\n${projectContext}`
      : "";

    const response = await client.messages.send(sid, {
      parts: [{ type: "text", text: `Generate ${AI_EXAMPLE_REQUEST_COUNT} creative and diverse workflow prompt ideas that a user might want to build. Each should involve multiple node types (agents, if-else, switch, ask-user, skills, documents, sub-workflows). Return ONLY a JSON array of ${AI_EXAMPLE_REQUEST_COUNT} strings, no explanation. Example format: [\"prompt 1\", \"prompt 2\", ...]${projectHint}` }],
      model: { providerID: providerId, modelID: modelId },
      system: "You output ONLY valid JSON arrays of strings. No markdown, no code fences, no explanation. Just the JSON array.",
    }, {
      signal: abortController.signal,
      timeout: AI_EXAMPLES_TIMEOUT_MS,
    });

    if (response.info.role === "assistant" && response.info.error) {
      set({ aiExamplesStatus: "error", _examplesAbortController: null });
      return;
    }

    const fullText = extractTextFromParts(response.parts);

    // Parse the JSON array from the response
    try {
      // Strip code fences if the model wraps them anyway
      let cleaned = fullText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        const newExamples = parsed
          .filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
          .map((s: string) => s.trim());

        if (prepend) {
          // Prepend new examples before existing ones, deduplicate
          const existing = get().aiExamples;
          const existingSet = new Set(existing);
          const unique = newExamples.filter((e: string) => !existingSet.has(e));
          set({ aiExamples: [...unique, ...existing], aiExamplesStatus: "done", _examplesAbortController: null });
        } else {
          set({ aiExamples: newExamples, aiExamplesStatus: "done", _examplesAbortController: null });
        }
      } else {
        set({ aiExamplesStatus: "error", _examplesAbortController: null });
      }
    } catch {
      set({ aiExamplesStatus: "error", _examplesAbortController: null });
    }
  } catch {
    if (abortController.signal.aborted) {
      set({ aiExamplesStatus: "idle", _examplesAbortController: null });
      return;
    }
    set({ aiExamplesStatus: "error", _examplesAbortController: null });
  }
}


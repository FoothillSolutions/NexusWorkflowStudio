import type { OpenCodeClient } from "@/lib/opencode";
import { estimateTokens, extractTextFromParts } from "./helpers";

interface PromptGenRequest {
  parts: Array<{ type: "text"; text: string }>;
  model: {
    providerID: string;
    modelID: string;
  };
  system: string;
}

interface RunPromptGenRequestOptions {
  client: OpenCodeClient;
  sessionId: string;
  request: PromptGenRequest;
  signal: AbortSignal;
  onText: (text: string, tokenEstimate: number) => void;
}

interface RunPromptGenRequestResult {
  text: string;
  aborted: boolean;
  error: string | null;
}

export async function runPromptGenRequest({
  client,
  sessionId,
  request,
  signal,
  onText,
}: RunPromptGenRequestOptions): Promise<RunPromptGenRequestResult> {
  let fullText = "";
  const partTexts = new Map<string, string>();
  const recomputeFullText = () => {
    let combined = "";
    for (const t of partTexts.values()) combined += t;
    fullText = combined;
    onText(fullText, estimateTokens(fullText));
  };

  try {
    await client.messages.sendAsync(sessionId, request, { signal });

    for await (const event of client.events.subscribe({ signal })) {
      if (signal.aborted) {
        return { text: fullText, aborted: true, error: null };
      }

      if (event.type === "message.part.delta") {
        const props = event.properties as {
          sessionID: string;
          messageID: string;
          partID: string;
          field: string;
          delta: string;
        };
        if (props.sessionID === sessionId && props.field === "text") {
          partTexts.set(props.partID, (partTexts.get(props.partID) ?? "") + props.delta);
          recomputeFullText();
        }
        continue;
      }

      if (event.type === "message.part.updated") {
        const props = event.properties as {
          part: {
            id: string;
            sessionID: string;
            type: string;
            text?: string;
          };
        };
        const part = props.part;
        if (part.sessionID === sessionId && part.type === "text" && typeof part.text === "string") {
          partTexts.set(part.id, part.text);
          recomputeFullText();
        }
        continue;
      }

      if (event.type === "session.idle") {
        const props = event.properties as { sessionID: string };
        if (props.sessionID === sessionId) break;
        continue;
      }

      if (event.type === "session.error") {
        const props = event.properties as {
          sessionID?: string;
          error?: { data?: { message?: string } };
        };
        if (props.sessionID === sessionId) {
          return {
            text: fullText,
            aborted: false,
            error: props.error?.data?.message ?? "Generation failed",
          };
        }
      }
    }

    if (!fullText.trim()) {
      const messages = await client.messages.list(sessionId, 2);
      const assistantMessage = messages.find((message) => message.info.role === "assistant");
      if (assistantMessage) {
        fullText = extractTextFromParts(assistantMessage.parts);
        onText(fullText, estimateTokens(fullText));
      }
    }

    return { text: fullText, aborted: false, error: null };
  } catch (error) {
    if (signal.aborted) {
      return { text: fullText, aborted: true, error: null };
    }

    return {
      text: fullText,
      aborted: false,
      error: error instanceof Error ? error.message : "Generation failed",
    };
  }
}



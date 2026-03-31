import { describe, expect, it, mock } from "bun:test";
import { runPromptGenRequest } from "../../prompt-gen";

function createEvents(values: unknown[]) {
  return {
    async *subscribe() {
      for (const value of values) {
        yield value;
      }
    },
  };
}

describe("runPromptGenRequest", () => {
  it("streams text deltas and reports token updates", async () => {
    const onText = mock(() => {});
    const client = {
      messages: {
        sendAsync: mock(async () => undefined),
        list: mock(async () => []),
      },
      events: createEvents([
        {
          type: "message.part.delta",
          properties: { sessionID: "session-1", field: "text", delta: "Hello" },
        },
        {
          type: "message.part.delta",
          properties: { sessionID: "session-1", field: "text", delta: " world" },
        },
        {
          type: "session.idle",
          properties: { sessionID: "session-1" },
        },
      ]),
    };

    const result = await runPromptGenRequest({
      client: client as never,
      sessionId: "session-1",
      request: {
        parts: [{ type: "text", text: "Generate something" }],
        model: { providerID: "github-copilot", modelID: "claude-sonnet-4.5" },
        system: "system",
      },
      signal: new AbortController().signal,
      onText,
    });

    expect(result).toEqual({ text: "Hello world", aborted: false, error: null });
    expect(onText).toHaveBeenCalledTimes(2);
    expect(onText).toHaveBeenLastCalledWith("Hello world", 3);
  });

  it("falls back to the latest assistant message when the stream is empty", async () => {
    const onText = mock(() => {});
    const client = {
      messages: {
        sendAsync: mock(async () => undefined),
        list: mock(async () => [
          {
            info: { role: "assistant" },
            parts: [{ type: "text", text: "Fallback output" }],
          },
        ]),
      },
      events: createEvents([
        {
          type: "session.idle",
          properties: { sessionID: "session-2" },
        },
      ]),
    };

    const result = await runPromptGenRequest({
      client: client as never,
      sessionId: "session-2",
      request: {
        parts: [{ type: "text", text: "Generate something else" }],
        model: { providerID: "github-copilot", modelID: "claude-sonnet-4.5" },
        system: "system",
      },
      signal: new AbortController().signal,
      onText,
    });

    expect(result).toEqual({ text: "Fallback output", aborted: false, error: null });
    expect(client.messages.list).toHaveBeenCalledWith("session-2", 2);
    expect(onText).toHaveBeenCalledWith("Fallback output", 4);
  });
});





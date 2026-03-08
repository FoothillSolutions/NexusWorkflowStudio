import type { HttpClient, RequestOptions } from "../client";
import type {
  MessageWithParts,
  AssistantMessage,
  PromptPayload,
  CommandPayload,
  ShellPayload,
} from "../types";

export function createMessageService(http: HttpClient) {
  return {
    /** GET /session/{sessionID}/message — List all messages in a session. */
    async list(sessionID: string, limit?: number, opts?: RequestOptions): Promise<MessageWithParts[]> {
      return http.get<MessageWithParts[]>(
        `/session/${encodeURIComponent(sessionID)}/message`,
        { ...opts, query: { ...opts?.query, ...(limit !== undefined && { limit }) } },
      );
    },

    /** GET /session/{sessionID}/message/{messageID} — Get a specific message. */
    async get(sessionID: string, messageID: string, opts?: RequestOptions): Promise<MessageWithParts> {
      return http.get<MessageWithParts>(
        `/session/${encodeURIComponent(sessionID)}/message/${encodeURIComponent(messageID)}`,
        opts,
      );
    },

    /** POST /session/{sessionID}/message — Send a prompt. */
    async send(sessionID: string, payload: PromptPayload, opts?: RequestOptions): Promise<MessageWithParts> {
      return http.post<MessageWithParts>(
        `/session/${encodeURIComponent(sessionID)}/message`,
        payload,
        opts,
      );
    },

    /** POST /session/{sessionID}/prompt_async — Send a prompt asynchronously. */
    async sendAsync(sessionID: string, payload: PromptPayload, opts?: RequestOptions): Promise<void> {
      await http.post<boolean>(
        `/session/${encodeURIComponent(sessionID)}/prompt_async`,
        payload,
        opts,
      );
    },

    /** DELETE /session/{sessionID}/message/{messageID} — Delete a message. */
    async delete(sessionID: string, messageID: string, opts?: RequestOptions): Promise<boolean> {
      return http.delete<boolean>(
        `/session/${encodeURIComponent(sessionID)}/message/${encodeURIComponent(messageID)}`,
        undefined,
        opts,
      );
    },

    /** POST /session/{sessionID}/command — Send a command to a session. */
    async sendCommand(sessionID: string, payload: CommandPayload, opts?: RequestOptions): Promise<MessageWithParts> {
      return http.post<MessageWithParts>(
        `/session/${encodeURIComponent(sessionID)}/command`,
        payload,
        opts,
      );
    },

    /** POST /session/{sessionID}/shell — Run a shell command within session context. */
    async runShell(sessionID: string, payload: ShellPayload, opts?: RequestOptions): Promise<AssistantMessage> {
      return http.post<AssistantMessage>(
        `/session/${encodeURIComponent(sessionID)}/shell`,
        payload,
        opts,
      );
    },
  } as const;
}

export type MessageService = ReturnType<typeof createMessageService>;


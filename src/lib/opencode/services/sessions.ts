import type { HttpClient, RequestOptions } from "../client";
import type {
  Session,
  GlobalSession,
  SessionListParams,
  GlobalSessionListParams,
  SessionCreatePayload,
  SessionUpdatePayload,
  SessionStatusType,
  FileDiff,
  Todo,
} from "../types";

export function createSessionService(http: HttpClient) {
  return {
    // ── CRUD ───────────────────────────────────────────────────────────

    /** GET /session — List sessions for the current instance. */
    async list(params?: SessionListParams, opts?: RequestOptions): Promise<Session[]> {
      return http.get<Session[]>("/session", {
        ...opts,
        params: { directory: params?.directory, workspace: params?.workspace, ...opts?.params },
        query: {
          ...opts?.query,
          ...(params?.roots !== undefined && { roots: params.roots }),
          ...(params?.start !== undefined && { start: params.start }),
          ...(params?.search !== undefined && { search: params.search }),
          ...(params?.limit !== undefined && { limit: params.limit }),
        },
      });
    },

    /** GET /experimental/session — List sessions across all projects. */
    async listGlobal(params?: GlobalSessionListParams, opts?: RequestOptions): Promise<GlobalSession[]> {
      return http.get<GlobalSession[]>("/experimental/session", {
        ...opts,
        params: { directory: params?.directory, workspace: params?.workspace, ...opts?.params },
        query: {
          ...opts?.query,
          ...(params?.roots !== undefined && { roots: params.roots }),
          ...(params?.start !== undefined && { start: params.start }),
          ...(params?.cursor !== undefined && { cursor: params.cursor }),
          ...(params?.search !== undefined && { search: params.search }),
          ...(params?.limit !== undefined && { limit: params.limit }),
          ...(params?.archived !== undefined && { archived: params.archived }),
        },
      });
    },

    /** POST /session — Create a new session. */
    async create(payload?: SessionCreatePayload, opts?: RequestOptions): Promise<Session> {
      return http.post<Session>("/session", payload, opts);
    },

    /** GET /session/{sessionID} — Get a session by ID. */
    async get(sessionID: string, opts?: RequestOptions): Promise<Session> {
      return http.get<Session>(`/session/${encodeURIComponent(sessionID)}`, opts);
    },

    /** PATCH /session/{sessionID} — Update session properties. */
    async update(sessionID: string, payload: SessionUpdatePayload, opts?: RequestOptions): Promise<Session> {
      return http.patch<Session>(`/session/${encodeURIComponent(sessionID)}`, payload, opts);
    },

    /** DELETE /session/{sessionID} — Permanently delete a session. */
    async delete(sessionID: string, opts?: RequestOptions): Promise<boolean> {
      return http.delete<boolean>(`/session/${encodeURIComponent(sessionID)}`, undefined, opts);
    },

    // ── Status ─────────────────────────────────────────────────────────

    /** GET /session/status — Get status of all sessions. */
    async status(opts?: RequestOptions): Promise<Record<string, SessionStatusType>> {
      return http.get<Record<string, SessionStatusType>>("/session/status", opts);
    },

    // ── Children / Relationships ───────────────────────────────────────

    /** GET /session/{sessionID}/children — Get child sessions. */
    async children(sessionID: string, opts?: RequestOptions): Promise<Session[]> {
      return http.get<Session[]>(`/session/${encodeURIComponent(sessionID)}/children`, opts);
    },

    // ── Todos ──────────────────────────────────────────────────────────

    /** GET /session/{sessionID}/todo — Get todo list for a session. */
    async todo(sessionID: string, opts?: RequestOptions): Promise<Todo[]> {
      return http.get<Todo[]>(`/session/${encodeURIComponent(sessionID)}/todo`, opts);
    },

    // ── Lifecycle ──────────────────────────────────────────────────────

    /** POST /session/{sessionID}/init — Initialize a session (creates AGENTS.md). */
    async init(
      sessionID: string,
      payload: { modelID: string; providerID: string; messageID: string },
      opts?: RequestOptions,
    ): Promise<boolean> {
      return http.post<boolean>(`/session/${encodeURIComponent(sessionID)}/init`, payload, opts);
    },

    /** POST /session/{sessionID}/fork — Fork a session at a message point. */
    async fork(sessionID: string, messageID?: string, opts?: RequestOptions): Promise<Session> {
      return http.post<Session>(
        `/session/${encodeURIComponent(sessionID)}/fork`,
        messageID ? { messageID } : undefined,
        opts,
      );
    },

    /** POST /session/{sessionID}/abort — Abort an active session. */
    async abort(sessionID: string, opts?: RequestOptions): Promise<boolean> {
      return http.post<boolean>(`/session/${encodeURIComponent(sessionID)}/abort`, undefined, opts);
    },

    /** POST /session/{sessionID}/summarize — Generate a summary via compaction. */
    async summarize(
      sessionID: string,
      payload: { providerID: string; modelID: string; auto?: boolean },
      opts?: RequestOptions,
    ): Promise<boolean> {
      return http.post<boolean>(`/session/${encodeURIComponent(sessionID)}/summarize`, payload, opts);
    },

    // ── Share ──────────────────────────────────────────────────────────

    /** POST /session/{sessionID}/share — Create a shareable link. */
    async share(sessionID: string, opts?: RequestOptions): Promise<Session> {
      return http.post<Session>(`/session/${encodeURIComponent(sessionID)}/share`, undefined, opts);
    },

    /** DELETE /session/{sessionID}/share — Remove the shareable link. */
    async unshare(sessionID: string, opts?: RequestOptions): Promise<Session> {
      return http.delete<Session>(`/session/${encodeURIComponent(sessionID)}/share`, undefined, opts);
    },

    // ── Diff ───────────────────────────────────────────────────────────

    /** GET /session/{sessionID}/diff — Get file changes for a message. */
    async diff(sessionID: string, messageID?: string, opts?: RequestOptions): Promise<FileDiff[]> {
      return http.get<FileDiff[]>(`/session/${encodeURIComponent(sessionID)}/diff`, {
        ...opts,
        query: { ...opts?.query, ...(messageID && { messageID }) },
      });
    },

    // ── Revert ─────────────────────────────────────────────────────────

    /** POST /session/{sessionID}/revert — Revert a message. */
    async revert(
      sessionID: string,
      payload: { messageID: string; partID?: string },
      opts?: RequestOptions,
    ): Promise<Session> {
      return http.post<Session>(`/session/${encodeURIComponent(sessionID)}/revert`, payload, opts);
    },

    /** POST /session/{sessionID}/unrevert — Restore reverted messages. */
    async unrevert(sessionID: string, opts?: RequestOptions): Promise<Session> {
      return http.post<Session>(`/session/${encodeURIComponent(sessionID)}/unrevert`, undefined, opts);
    },
  } as const;
}

export type SessionService = ReturnType<typeof createSessionService>;


import type { HttpClient, RequestOptions } from "../client";
import type { Pty, PtyCreatePayload, PtyUpdatePayload } from "../types";

export function createPtyService(http: HttpClient) {
  return {
    /** GET /pty — List all active PTY sessions. */
    async list(opts?: RequestOptions): Promise<Pty[]> {
      return http.get<Pty[]>("/pty", opts);
    },

    /** POST /pty — Create a new PTY session. */
    async create(payload?: PtyCreatePayload, opts?: RequestOptions): Promise<Pty> {
      return http.post<Pty>("/pty", payload, opts);
    },

    /** GET /pty/{ptyID} — Get a PTY session by ID. */
    async get(ptyID: string, opts?: RequestOptions): Promise<Pty> {
      return http.get<Pty>(`/pty/${encodeURIComponent(ptyID)}`, opts);
    },

    /** PUT /pty/{ptyID} — Update a PTY session (title, size). */
    async update(ptyID: string, payload: PtyUpdatePayload, opts?: RequestOptions): Promise<Pty> {
      return http.put<Pty>(`/pty/${encodeURIComponent(ptyID)}`, payload, opts);
    },

    /** DELETE /pty/{ptyID} — Remove and terminate a PTY session. */
    async remove(ptyID: string, opts?: RequestOptions): Promise<boolean> {
      return http.delete<boolean>(`/pty/${encodeURIComponent(ptyID)}`, undefined, opts);
    },

    /**
     * GET /pty/{ptyID}/connect — WebSocket endpoint for PTY interaction.
     * Returns the URL to use with `new WebSocket(url)`.
     */
    getConnectUrl(ptyID: string): string {
      const base = http.baseUrl.replace(/^http/, "ws");
      return `${base}/pty/${encodeURIComponent(ptyID)}/connect`;
    },
  } as const;
}

export type PtyService = ReturnType<typeof createPtyService>;


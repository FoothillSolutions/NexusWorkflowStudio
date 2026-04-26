import type { HttpClient, RequestOptions } from "../client";
import type { PermissionRequest, PermissionReply, SessionPermissionResponsePayload } from "../types";

export function createPermissionService(http: HttpClient) {
  return {
    /** GET /permission — List all pending permission requests. */
    async list(opts?: RequestOptions): Promise<PermissionRequest[]> {
      return http.get<PermissionRequest[]>("/permission", opts);
    },

    /** POST /permission/{requestID}/reply — Reply to a permission request. */
    async reply(
      requestID: string,
      reply: PermissionReply,
      message?: string,
      opts?: RequestOptions,
    ): Promise<boolean> {
      return http.post<boolean>(
        `/permission/${encodeURIComponent(requestID)}/reply`,
        { reply, ...(message !== undefined && { message }) },
        opts,
      );
    },

    /**
     * POST /session/{sessionID}/permissions/{permissionID} — Respond (deprecated).
     * @deprecated Use `reply()` instead.
     */
    async respond(
      sessionID: string,
      permissionID: string,
      response: PermissionReply,
      opts?: RequestOptions,
    ): Promise<boolean> {
      return http.post<boolean>(
        `/session/${encodeURIComponent(sessionID)}/permissions/${encodeURIComponent(permissionID)}`,
        { response },
        opts,
      );
    },

    /** POST /session/{sessionID}/permission — Reply to a forwarded ACP permission request. */
    async respondToSession(
      sessionID: string,
      payload: SessionPermissionResponsePayload,
      opts?: RequestOptions,
    ): Promise<boolean> {
      return http.post<boolean>(
        `/session/${encodeURIComponent(sessionID)}/permission`,
        payload,
        opts,
      );
    },
  } as const;
}

export type PermissionService = ReturnType<typeof createPermissionService>;


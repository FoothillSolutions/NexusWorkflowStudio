import type { HttpClient, RequestOptions } from "../client";
import type { Workspace, WorkspaceCreatePayload } from "../types";

export function createWorkspaceService(http: HttpClient) {
  return {
    /** GET /experimental/workspace — List all workspaces. */
    async list(opts?: RequestOptions): Promise<Workspace[]> {
      return http.get<Workspace[]>("/experimental/workspace", opts);
    },

    /** POST /experimental/workspace/{id} — Create a workspace. */
    async create(
      id: string,
      payload: WorkspaceCreatePayload,
      opts?: RequestOptions,
    ): Promise<Workspace> {
      return http.post<Workspace>(
        `/experimental/workspace/${encodeURIComponent(id)}`,
        payload,
        opts,
      );
    },

    /** DELETE /experimental/workspace/{id} — Remove a workspace. */
    async remove(id: string, opts?: RequestOptions): Promise<Workspace> {
      return http.delete<Workspace>(
        `/experimental/workspace/${encodeURIComponent(id)}`,
        undefined,
        opts,
      );
    },
  } as const;
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;


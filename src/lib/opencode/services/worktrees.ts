import type { HttpClient, RequestOptions } from "../client";
import type { Worktree, WorktreeCreateInput, WorktreeRemoveInput, WorktreeResetInput } from "../types";

export function createWorktreeService(http: HttpClient) {
  return {
    /** POST /experimental/worktree — Create a new git worktree. */
    async create(payload?: WorktreeCreateInput, opts?: RequestOptions): Promise<Worktree> {
      return http.post<Worktree>("/experimental/worktree", payload, opts);
    },

    /** GET /experimental/worktree — List all worktree directories. */
    async list(opts?: RequestOptions): Promise<string[]> {
      return http.get<string[]>("/experimental/worktree", opts);
    },

    /** DELETE /experimental/worktree — Remove a worktree and its branch. */
    async remove(payload: WorktreeRemoveInput, opts?: RequestOptions): Promise<boolean> {
      return http.delete<boolean>("/experimental/worktree", payload, opts);
    },

    /** POST /experimental/worktree/reset — Reset a worktree to the default branch. */
    async reset(payload: WorktreeResetInput, opts?: RequestOptions): Promise<boolean> {
      return http.post<boolean>("/experimental/worktree/reset", payload, opts);
    },
  } as const;
}

export type WorktreeService = ReturnType<typeof createWorktreeService>;


import type { HttpClient, RequestOptions } from "../client";
import type { ToolIDs, ToolListItem, ToolListParams } from "../types";

export function createToolService(http: HttpClient) {
  return {
    /** GET /experimental/tool/ids — List all available tool IDs. */
    async listIds(opts?: RequestOptions): Promise<ToolIDs> {
      return http.get<ToolIDs>("/experimental/tool/ids", opts);
    },

    /** GET /experimental/tool — List tools with schemas for a provider/model. */
    async list(params: ToolListParams, opts?: RequestOptions): Promise<ToolListItem[]> {
      return http.get<ToolListItem[]>("/experimental/tool", {
        ...opts,
        params: { directory: params.directory, workspace: params.workspace, ...opts?.params },
        query: { ...opts?.query, provider: params.provider, model: params.model },
      });
    },
  } as const;
}

export type ToolService = ReturnType<typeof createToolService>;


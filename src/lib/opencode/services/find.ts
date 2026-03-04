import type { HttpClient, RequestOptions } from "../client";
import type {
  TextMatch,
  Symbol,
  FindTextParams,
  FindFilesParams,
  FindSymbolsParams,
} from "../types";

export function createFindService(http: HttpClient) {
  return {
    /** GET /find — Search for text patterns across project files (ripgrep). */
    async text(params: FindTextParams, opts?: RequestOptions): Promise<TextMatch[]> {
      return http.get<TextMatch[]>("/find", {
        ...opts,
        params: { directory: params.directory, workspace: params.workspace, ...opts?.params },
        query: { ...opts?.query, pattern: params.pattern },
      });
    },

    /** GET /find/file — Search for files or directories by name. */
    async files(params: FindFilesParams, opts?: RequestOptions): Promise<string[]> {
      return http.get<string[]>("/find/file", {
        ...opts,
        params: { directory: params.directory, workspace: params.workspace, ...opts?.params },
        query: {
          ...opts?.query,
          query: params.query,
          ...(params.dirs !== undefined && { dirs: params.dirs }),
          ...(params.type !== undefined && { type: params.type }),
          ...(params.limit !== undefined && { limit: params.limit }),
        },
      });
    },

    /** GET /find/symbol — Search for workspace symbols via LSP. */
    async symbols(params: FindSymbolsParams, opts?: RequestOptions): Promise<Symbol[]> {
      return http.get<Symbol[]>("/find/symbol", {
        ...opts,
        params: { directory: params.directory, workspace: params.workspace, ...opts?.params },
        query: { ...opts?.query, query: params.query },
      });
    },
  } as const;
}

export type FindService = ReturnType<typeof createFindService>;


import type { HttpClient, RequestOptions } from "../client";
import type { MCPStatus, McpLocalConfig, McpRemoteConfig } from "../types";

export function createMcpService(http: HttpClient) {
  return {
    /** GET /mcp — Get status of all MCP servers. */
    async status(opts?: RequestOptions): Promise<Record<string, MCPStatus>> {
      return http.get<Record<string, MCPStatus>>("/mcp", opts);
    },

    /** POST /mcp — Add a new MCP server. */
    async add(
      name: string,
      config: McpLocalConfig | McpRemoteConfig,
      opts?: RequestOptions,
    ): Promise<Record<string, MCPStatus>> {
      return http.post<Record<string, MCPStatus>>("/mcp", { name, config }, opts);
    },

    /** POST /mcp/{name}/connect — Connect to an MCP server. */
    async connect(name: string, opts?: RequestOptions): Promise<boolean> {
      return http.post<boolean>(`/mcp/${encodeURIComponent(name)}/connect`, undefined, opts);
    },

    /** POST /mcp/{name}/disconnect — Disconnect an MCP server. */
    async disconnect(name: string, opts?: RequestOptions): Promise<boolean> {
      return http.post<boolean>(`/mcp/${encodeURIComponent(name)}/disconnect`, undefined, opts);
    },

    /** POST /mcp/{name}/auth — Start OAuth flow for an MCP server. */
    async authStart(name: string, opts?: RequestOptions): Promise<{ authorizationUrl: string }> {
      return http.post<{ authorizationUrl: string }>(
        `/mcp/${encodeURIComponent(name)}/auth`,
        undefined,
        opts,
      );
    },

    /** POST /mcp/{name}/auth/callback — Complete OAuth for an MCP server. */
    async authCallback(name: string, code: string, opts?: RequestOptions): Promise<MCPStatus> {
      return http.post<MCPStatus>(
        `/mcp/${encodeURIComponent(name)}/auth/callback`,
        { code },
        opts,
      );
    },

    /** POST /mcp/{name}/auth/authenticate — Full OAuth flow (opens browser). */
    async authenticate(name: string, opts?: RequestOptions): Promise<MCPStatus> {
      return http.post<MCPStatus>(
        `/mcp/${encodeURIComponent(name)}/auth/authenticate`,
        undefined,
        opts,
      );
    },

    /** DELETE /mcp/{name}/auth — Remove OAuth credentials for an MCP server. */
    async authRemove(name: string, opts?: RequestOptions): Promise<{ success: true }> {
      return http.delete<{ success: true }>(
        `/mcp/${encodeURIComponent(name)}/auth`,
        undefined,
        opts,
      );
    },
  } as const;
}

export type McpService = ReturnType<typeof createMcpService>;


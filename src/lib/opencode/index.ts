// OpenCode API Client

// Central entry-point for the entire opencode module.
//
// Usage:
//   import { createOpenCodeClient } from "@/lib/opencode";
//
//   const oc = createOpenCodeClient("http://127.0.0.1:4096");
//   const health = await oc.health.check();
//   const sessions = await oc.sessions.list();
//
// Or use the pre-wired singleton that reads the URL from the zustand store:
//   import { opencode } from "@/lib/opencode";
//   const health = await opencode.health.check();

import { HttpClient, type HttpClientOptions } from "./client";
import {
  createHealthService,
  createConfigService,
  createAuthService,
  createProviderService,
  createSessionService,
  createMessageService,
  createPartService,
  createMcpService,
  createToolService,
  createPermissionService,
  createQuestionService,
  createFindService,
  createFileService,
  createEventService,
  createPtyService,
  createWorktreeService,
  createWorkspaceService,
  createPathService,
  createVcsService,
  createCommandService,
  createAgentService,
  createSkillService,
  createLspService,
  createFormatterService,
  createLogService,
  createInstanceService,
  createProjectService,
  createResourceService,
} from "./services";
import { loadOpenCodeUrl } from "./config";

// Client type

export interface OpenCodeClient {
  /** The underlying HTTP client — useful for advanced / custom requests. */
  readonly http: HttpClient;

  /** Server health & version. */
  readonly health: ReturnType<typeof createHealthService>;
  /** Instance & global configuration. */
  readonly config: ReturnType<typeof createConfigService>;
  /** Provider auth credential management. */
  readonly auth: ReturnType<typeof createAuthService>;
  /** AI provider listing, auth methods, OAuth flows. */
  readonly providers: ReturnType<typeof createProviderService>;
  /** Session CRUD, lifecycle, sharing, diffs, reverts. */
  readonly sessions: ReturnType<typeof createSessionService>;
  /** Messages: list, send prompts, commands, shell. */
  readonly messages: ReturnType<typeof createMessageService>;
  /** Message parts: update, delete. */
  readonly parts: ReturnType<typeof createPartService>;
  /** MCP servers: status, add, connect, disconnect, OAuth. */
  readonly mcp: ReturnType<typeof createMcpService>;
  /** Tool listing. */
  readonly tools: ReturnType<typeof createToolService>;
  /** Permission requests: list, reply. */
  readonly permissions: ReturnType<typeof createPermissionService>;
  /** Question requests: list, reply, reject. */
  readonly questions: ReturnType<typeof createQuestionService>;
  /** Text / file / symbol search. */
  readonly find: ReturnType<typeof createFindService>;
  /** File listing, reading, git status. */
  readonly files: ReturnType<typeof createFileService>;
  /** SSE event streams (instance & global). */
  readonly events: ReturnType<typeof createEventService>;
  /** Pseudo-terminal sessions. */
  readonly pty: ReturnType<typeof createPtyService>;
  /** Git worktree management. */
  readonly worktrees: ReturnType<typeof createWorktreeService>;
  /** Workspace management. */
  readonly workspaces: ReturnType<typeof createWorkspaceService>;
  /** Path info. */
  readonly path: ReturnType<typeof createPathService>;
  /** VCS / git info. */
  readonly vcs: ReturnType<typeof createVcsService>;
  /** Registered commands. */
  readonly commands: ReturnType<typeof createCommandService>;
  /** AI agents. */
  readonly agents: ReturnType<typeof createAgentService>;
  /** Skills. */
  readonly skills: ReturnType<typeof createSkillService>;
  /** LSP server status. */
  readonly lsp: ReturnType<typeof createLspService>;
  /** Formatter status. */
  readonly formatter: ReturnType<typeof createFormatterService>;
  /** Server-side logging. */
  readonly log: ReturnType<typeof createLogService>;
  /** Instance lifecycle (dispose). */
  readonly instance: ReturnType<typeof createInstanceService>;
  /** Project management. */
  readonly projects: ReturnType<typeof createProjectService>;
  /** MCP resources. */
  readonly resources: ReturnType<typeof createResourceService>;
}

// Factory

/**
 * Create a fully-typed OpenCode API client.
 *
 * @param baseUrl  Server origin, e.g. `"http://127.0.0.1:4096"`
 * @param options  Additional HTTP client options (timeout, default params).
 */
export function createOpenCodeClient(
  baseUrl: string,
  options?: Omit<HttpClientOptions, "baseUrl">,
): OpenCodeClient {
  const http = new HttpClient({ baseUrl, ...options });

  return {
    http,
    health: createHealthService(http),
    config: createConfigService(http),
    auth: createAuthService(http),
    providers: createProviderService(http),
    sessions: createSessionService(http),
    messages: createMessageService(http),
    parts: createPartService(http),
    mcp: createMcpService(http),
    tools: createToolService(http),
    permissions: createPermissionService(http),
    questions: createQuestionService(http),
    find: createFindService(http),
    files: createFileService(http),
    events: createEventService(http),
    pty: createPtyService(http),
    worktrees: createWorktreeService(http),
    workspaces: createWorkspaceService(http),
    path: createPathService(http),
    vcs: createVcsService(http),
    commands: createCommandService(http),
    agents: createAgentService(http),
    skills: createSkillService(http),
    lsp: createLspService(http),
    formatter: createFormatterService(http),
    log: createLogService(http),
    instance: createInstanceService(http),
    projects: createProjectService(http),
    resources: createResourceService(http),
  };
}

// Singleton (lazy, reads URL from localStorage)

let _singleton: OpenCodeClient | null = null;

/**
 * Get a shared singleton client instance.
 * The base URL is read from `localStorage` (`nexus:opencode-url`), matching
 * the existing `useOpenCodeStore`.
 *
 * Call `resetOpenCodeClient()` after the URL changes to recreate it.
 */
export function getOpenCodeClient(): OpenCodeClient {
  if (!_singleton) {
    _singleton = createOpenCodeClient(loadOpenCodeUrl());
  }
  return _singleton;
}

/** Destroy the singleton so the next `getOpenCodeClient()` picks up a new URL. */
export function resetOpenCodeClient(): void {
  _singleton = null;
}

// Convenience alias

/** Shorthand: `opencode.sessions.list()` etc. */
export const opencode: OpenCodeClient = new Proxy({} as OpenCodeClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getOpenCodeClient(), prop, receiver);
  },
});

// Re-exports

export { HttpClient, type HttpClientOptions, type RequestOptions } from "./client";
export * from "./types";
export * from "./errors";


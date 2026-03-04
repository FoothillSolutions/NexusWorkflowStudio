import type { HttpClient, RequestOptions } from "../client";
import type {
  PathInfo,
  VcsInfo,
  Command,
  Agent,
  Skill,
  LSPStatus,
  FormatterStatus,
  LogEntry,
  Project,
  ProjectUpdatePayload,
  McpResource,
} from "../types";

// ── Path ─────────────────────────────────────────────────────────────────────

export function createPathService(http: HttpClient) {
  return {
    /** GET /path — Get CWD and related path info. */
    async get(opts?: RequestOptions): Promise<PathInfo> {
      return http.get<PathInfo>("/path", opts);
    },
  } as const;
}

export type PathService = ReturnType<typeof createPathService>;

// ── VCS ──────────────────────────────────────────────────────────────────────

export function createVcsService(http: HttpClient) {
  return {
    /** GET /vcs — Get version-control info (branch, etc.). */
    async get(opts?: RequestOptions): Promise<VcsInfo> {
      return http.get<VcsInfo>("/vcs", opts);
    },
  } as const;
}

export type VcsService = ReturnType<typeof createVcsService>;

// ── Commands ─────────────────────────────────────────────────────────────────

export function createCommandService(http: HttpClient) {
  return {
    /** GET /command — List all available commands. */
    async list(opts?: RequestOptions): Promise<Command[]> {
      return http.get<Command[]>("/command", opts);
    },
  } as const;
}

export type CommandService = ReturnType<typeof createCommandService>;

// ── Agents ───────────────────────────────────────────────────────────────────

export function createAgentService(http: HttpClient) {
  return {
    /** GET /agent — List all available AI agents. */
    async list(opts?: RequestOptions): Promise<Agent[]> {
      return http.get<Agent[]>("/agent", opts);
    },
  } as const;
}

export type AgentService = ReturnType<typeof createAgentService>;

// ── Skills ───────────────────────────────────────────────────────────────────

export function createSkillService(http: HttpClient) {
  return {
    /** GET /skill — List all available skills. */
    async list(opts?: RequestOptions): Promise<Skill[]> {
      return http.get<Skill[]>("/skill", opts);
    },
  } as const;
}

export type SkillService = ReturnType<typeof createSkillService>;

// ── LSP ──────────────────────────────────────────────────────────────────────

export function createLspService(http: HttpClient) {
  return {
    /** GET /lsp — Get LSP server status. */
    async status(opts?: RequestOptions): Promise<LSPStatus[]> {
      return http.get<LSPStatus[]>("/lsp", opts);
    },
  } as const;
}

export type LspService = ReturnType<typeof createLspService>;

// ── Formatter ────────────────────────────────────────────────────────────────

export function createFormatterService(http: HttpClient) {
  return {
    /** GET /formatter — Get formatter status. */
    async status(opts?: RequestOptions): Promise<FormatterStatus[]> {
      return http.get<FormatterStatus[]>("/formatter", opts);
    },
  } as const;
}

export type FormatterService = ReturnType<typeof createFormatterService>;

// ── Log ──────────────────────────────────────────────────────────────────────

export function createLogService(http: HttpClient) {
  return {
    /** POST /log — Write a log entry to the server. */
    async write(entry: LogEntry, opts?: RequestOptions): Promise<boolean> {
      return http.post<boolean>("/log", entry, opts);
    },
  } as const;
}

export type LogService = ReturnType<typeof createLogService>;

// ── Instance ─────────────────────────────────────────────────────────────────

export function createInstanceService(http: HttpClient) {
  return {
    /** POST /instance/dispose — Dispose the current instance. */
    async dispose(opts?: RequestOptions): Promise<boolean> {
      return http.post<boolean>("/instance/dispose", undefined, opts);
    },

    /** POST /global/dispose — Dispose ALL instances globally. */
    async disposeGlobal(opts?: RequestOptions): Promise<boolean> {
      return http.post<boolean>("/global/dispose", undefined, opts);
    },
  } as const;
}

export type InstanceService = ReturnType<typeof createInstanceService>;

// ── Projects ─────────────────────────────────────────────────────────────────

export function createProjectService(http: HttpClient) {
  return {
    /** GET /project — List all projects. */
    async list(opts?: RequestOptions): Promise<Project[]> {
      return http.get<Project[]>("/project", opts);
    },

    /** GET /project/current — Get the currently active project. */
    async current(opts?: RequestOptions): Promise<Project> {
      return http.get<Project>("/project/current", opts);
    },

    /** PATCH /project/{projectID} — Update project properties. */
    async update(
      projectID: string,
      payload: ProjectUpdatePayload,
      opts?: RequestOptions,
    ): Promise<Project> {
      return http.patch<Project>(
        `/project/${encodeURIComponent(projectID)}`,
        payload,
        opts,
      );
    },
  } as const;
}

export type ProjectService = ReturnType<typeof createProjectService>;

// ── Resources (MCP) ─────────────────────────────────────────────────────────

export function createResourceService(http: HttpClient) {
  return {
    /** GET /experimental/resource — List all MCP resources. */
    async list(opts?: RequestOptions): Promise<Record<string, McpResource>> {
      return http.get<Record<string, McpResource>>("/experimental/resource", opts);
    },
  } as const;
}

export type ResourceService = ReturnType<typeof createResourceService>;


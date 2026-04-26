// ─── OpenCode API Types ─────────────────────────────────────────────────────
// Derived from the OpenCode OpenAPI v0.0.3 specification.
// All types are pure TypeScript interfaces / type aliases — no runtime deps.

// ── Utility ─────────────────────────────────────────────────────────────────

/** Optional query params shared by almost every instance-scoped endpoint. */
export interface InstanceParams {
  directory?: string;
  workspace?: string;
}

// ── Health ───────────────────────────────────────────────────────────────────

export interface HealthInfo {
  healthy: true;
  version: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface OAuthCredentials {
  type: "oauth";
  refresh: string;
  access: string;
  expires: number;
  accountId?: string;
  enterpriseUrl?: string;
}

export interface ApiAuthCredentials {
  type: "api";
  key: string;
}

export interface WellKnownAuthCredentials {
  type: "wellknown";
  key: string;
  token: string;
}

export type AuthCredentials =
  | OAuthCredentials
  | ApiAuthCredentials
  | WellKnownAuthCredentials;

// ── Config ───────────────────────────────────────────────────────────────────

/**
 * Full configuration object. We type the commonly-used fields explicitly and
 * allow additional properties for forward-compatibility.
 */
export interface Config {
  $schema?: string;
  logLevel?: "DEBUG" | "INFO" | "WARN" | "ERROR";
  server?: ServerConfig;
  command?: Record<string, CommandConfig>;
  skills?: { paths?: string[]; urls?: string[] };
  watcher?: { ignore?: string[] };
  plugin?: string[];
  snapshot?: boolean;
  share?: "manual" | "auto" | "disabled";
  autoupdate?: boolean | "notify";
  disabled_providers?: string[];
  enabled_providers?: string[];
  model?: string;
  small_model?: string;
  default_agent?: string;
  username?: string;
  agent?: Record<string, AgentConfig>;
  provider?: Record<string, ProviderConfig>;
  mcp?: Record<string, McpLocalConfig | McpRemoteConfig | { enabled: boolean }>;
  permission?: PermissionConfig;
  tools?: Record<string, boolean>;
  enterprise?: { url?: string };
  compaction?: { auto?: boolean; prune?: boolean; reserved?: number };
  experimental?: Record<string, unknown>;
  formatter?: false | Record<string, FormatterRuleConfig>;
  lsp?: false | Record<string, LspRuleConfig>;
  instructions?: string[];
  layout?: "auto" | "stretch";
  [key: string]: unknown;
}

export interface ServerConfig {
  port?: number;
  hostname?: string;
  mdns?: boolean;
  mdnsDomain?: string;
  cors?: string[];
}

export interface CommandConfig {
  template: string;
  description?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

export interface FormatterRuleConfig {
  disabled?: boolean;
  command?: string[];
  environment?: Record<string, string>;
  extensions?: string[];
}

export interface LspRuleConfig {
  disabled?: boolean;
  command?: string[];
  extensions?: string[];
  env?: Record<string, string>;
  initialization?: Record<string, unknown>;
}

// ── Permissions ──────────────────────────────────────────────────────────────

export type PermissionAction = "allow" | "deny" | "ask";

export interface PermissionRule {
  permission: string;
  pattern: string;
  action: PermissionAction;
}

export type PermissionRuleset = PermissionRule[];

export type PermissionActionConfig = "ask" | "allow" | "deny";
export type PermissionObjectConfig = Record<string, PermissionActionConfig>;
export type PermissionRuleConfig = PermissionActionConfig | PermissionObjectConfig;
export type PermissionConfig = Record<string, PermissionRuleConfig> | PermissionActionConfig;

export type BridgePermissionMode = "auto" | "forward";

export interface BridgePermissionOption {
  name: string;
  kind: string;
  optionId: string;
}

export interface BridgePermissionRequestedEvent {
  sessionID: string;
  requestID: string;
  toolCall: { title: string; kind?: string };
  options: BridgePermissionOption[];
}

export interface BridgePermissionResponsePayload {
  requestID: string;
  outcome: "selected" | "cancelled";
  optionId?: string;
}

export interface BridgeToolCallEventProperties {
  sessionID: string;
  messageID: string;
  callID: string;
  title: string;
  kind?: string;
  rawInput?: unknown;
  status: "pending" | "running" | "completed" | "failed";
}

export interface BridgeToolCallUpdatedEventProperties extends BridgeToolCallEventProperties {
  rawOutput?: unknown;
  error?: string;
}

export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
}

export type PermissionReply = "once" | "always" | "reject";

// ── Questions ────────────────────────────────────────────────────────────────

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: { messageID: string; callID: string };
}

export type QuestionAnswer = string[];

// ── Agents ───────────────────────────────────────────────────────────────────

export interface AgentConfig {
  model?: string;
  variant?: string;
  temperature?: number;
  top_p?: number;
  prompt?: string;
  tools?: Record<string, boolean>;
  disable?: boolean;
  description?: string;
  mode?: "subagent" | "primary" | "all";
  hidden?: boolean;
  options?: Record<string, unknown>;
  color?: string;
  steps?: number;
  maxSteps?: number;
  permission?: PermissionConfig;
  [key: string]: unknown;
}

export interface Agent {
  name: string;
  description?: string;
  mode: "subagent" | "primary" | "all";
  native?: boolean;
  hidden?: boolean;
  topP?: number;
  temperature?: number;
  color?: string;
  permission: PermissionRuleset;
  model?: { modelID: string; providerID: string };
  variant?: string;
  prompt?: string;
  options: Record<string, unknown>;
  steps?: number;
}

// ── Skills ───────────────────────────────────────────────────────────────────

export interface Skill {
  name: string;
  description: string;
  location: string;
  content: string;
}

// ── Providers ────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  api?: string;
  name?: string;
  env?: string[];
  id?: string;
  npm?: string;
  models?: Record<string, ModelDefinition>;
  whitelist?: string[];
  blacklist?: string[];
  options?: ProviderOptions;
  [key: string]: unknown;
}

export interface ProviderOptions {
  apiKey?: string;
  baseURL?: string;
  enterpriseUrl?: string;
  setCacheKey?: boolean;
  timeout?: number | false;
  [key: string]: unknown;
}

export interface ModelDefinition {
  id: string;
  name: string;
  family?: string;
  release_date?: string;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  tool_call?: boolean;
  interleaved?: true | { field: "reasoning_content" | "reasoning_details" };
  cost?: ModelCost;
  limit?: ModelLimit;
  modalities?: { input: ModalityKind[]; output: ModalityKind[] };
  experimental?: boolean;
  status?: "alpha" | "beta" | "deprecated";
  options?: Record<string, unknown>;
  headers?: Record<string, string>;
  provider?: { npm?: string; api?: string };
  variants?: Record<string, Record<string, unknown>>;
}

export type ModalityKind = "text" | "audio" | "image" | "video" | "pdf";

export interface ModelCost {
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
  context_over_200k?: { input: number; output: number; cache_read?: number; cache_write?: number };
}

export interface ModelLimit {
  context?: number;
  input?: number;
  output: number;
}

export interface Model {
  id: string;
  providerID: string;
  api: { id: string; url: string; npm: string };
  name: string;
  family?: string;
  capabilities: ModelCapabilities;
  cost: { input: number; output: number; cache: { read: number; write: number }; experimentalOver200K?: { input: number; output: number; cache: { read: number; write: number } } };
  limit: ModelLimit;
  status: "alpha" | "beta" | "deprecated" | "active";
  options: Record<string, unknown>;
  headers: Record<string, string>;
  release_date: string;
  variants?: Record<string, Record<string, unknown>>;
}

export interface ModelCapabilities {
  temperature: boolean;
  reasoning: boolean;
  attachment: boolean;
  toolcall: boolean;
  input: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean };
  output: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean };
  interleaved: boolean | { field: string };
}

export interface Provider {
  id: string;
  name: string;
  source: "env" | "config" | "custom" | "api";
  env: string[];
  key?: string;
  options: Record<string, unknown>;
  models: Record<string, Model>;
}

export interface ProviderListResult {
  all: Array<{
    api?: string;
    name: string;
    env: string[];
    id: string;
    npm?: string;
    models: Record<string, ModelDefinition>;
  }>;
  default: Record<string, string>;
  connected: string[];
}

export interface ProviderAuthMethod {
  type: "oauth" | "api";
  label: string;
}

export interface ProviderAuthAuthorization {
  url: string;
  method: "auto" | "code";
  instructions: string;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export interface FileDiff {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
  status?: "added" | "deleted" | "modified";
}

export interface Session {
  id: string;
  slug: string;
  projectID: string;
  workspaceID?: string;
  directory: string;
  parentID?: string;
  summary?: {
    additions: number;
    deletions: number;
    files: number;
    diffs?: FileDiff[];
  };
  share?: { url: string };
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
  permission?: PermissionRuleset;
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
}

export interface GlobalSession extends Session {
  project: { id: string; name?: string; worktree: string } | null;
}

export type SessionStatusType =
  | { type: "idle" }
  | { type: "retry"; attempt: number; message: string; next: number }
  | { type: "busy" };

export interface SessionListParams extends InstanceParams {
  roots?: boolean;
  start?: number;
  search?: string;
  limit?: number;
}

export interface GlobalSessionListParams extends SessionListParams {
  cursor?: number;
  archived?: boolean;
}

export interface SessionCreatePayload {
  parentID?: string;
  title?: string;
  permission?: PermissionRuleset;
  permissionMode?: BridgePermissionMode;
}

export interface SessionUpdatePayload {
  title?: string;
  time?: { archived?: number };
}

// ── Messages ─────────────────────────────────────────────────────────────────

export interface UserMessage {
  id: string;
  sessionID: string;
  role: "user";
  time: { created: number };
  format?: OutputFormat;
  summary?: { title?: string; body?: string; diffs: FileDiff[] };
  agent?: string;
  model?: { providerID: string; modelID: string };
  system?: string;
  tools?: Record<string, boolean>;
  variant?: string;
}

export interface AssistantMessage {
  id: string;
  sessionID: string;
  role: "assistant";
  time: { created: number; completed?: number };
  error?: MessageError;
  parentID: string;
  modelID: string;
  providerID: string;
  mode: string;
  agent: string;
  path: { cwd: string; root: string };
  summary?: boolean;
  cost: number;
  tokens: TokenUsage;
  structured?: unknown;
  variant?: string;
  finish?: string;
}

export type Message = UserMessage | AssistantMessage;

export interface TokenUsage {
  total?: number;
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

export type MessageError =
  | { name: "ProviderAuthError"; data: { providerID: string; message: string } }
  | { name: "UnknownError"; data: { message: string } }
  | { name: "MessageOutputLengthError"; data: Record<string, never> }
  | { name: "MessageAbortedError"; data: { message: string } }
  | { name: "StructuredOutputError"; data: { message: string; retries: number } }
  | { name: "ContextOverflowError"; data: { message: string; responseBody?: string } }
  | { name: "APIError"; data: { message: string; statusCode?: number; isRetryable: boolean; responseHeaders?: Record<string, string>; responseBody?: string; metadata?: Record<string, string> } };

export type OutputFormat =
  | { type: "text" }
  | { type: "json_schema"; schema: Record<string, unknown>; retryCount?: number };

export interface MessageWithParts {
  info: Message;
  parts: Part[];
}

// ── Message Part Inputs ──────────────────────────────────────────────────────

export interface TextPartInput {
  id?: string;
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

export interface FilePartInput {
  id?: string;
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: FilePartSource;
}

export interface AgentPartInput {
  id?: string;
  type: "agent";
  name: string;
  source?: { value: string; start: number; end: number };
}

export interface SubtaskPartInput {
  id?: string;
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  model?: { providerID: string; modelID: string };
  command?: string;
}

export type PromptPartInput = TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput;

export interface PromptPayload {
  messageID?: string;
  model?: { providerID: string; modelID: string };
  agent?: string;
  noReply?: boolean;
  tools?: Record<string, boolean>;
  format?: OutputFormat;
  system?: string;
  variant?: string;
  parts: PromptPartInput[];
}

export interface CommandPayload {
  messageID?: string;
  agent?: string;
  model?: string;
  arguments: string;
  command: string;
  variant?: string;
  parts?: FilePartInput[];
}

export interface ShellPayload {
  agent: string;
  model?: { providerID: string; modelID: string };
  command: string;
}

// ── Parts ────────────────────────────────────────────────────────────────────

export interface FilePartSourceText {
  value: string;
  start: number;
  end: number;
}

export type FilePartSource =
  | { text: FilePartSourceText; type: "file"; path: string }
  | { text: FilePartSourceText; type: "symbol"; path: string; range: Range; name: string; kind: number }
  | { text: FilePartSourceText; type: "resource"; clientName: string; uri: string };

export interface Range {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface TextPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

export interface SubtaskPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  model?: { providerID: string; modelID: string };
  command?: string;
}

export interface ReasoningPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "reasoning";
  text: string;
  metadata?: Record<string, unknown>;
  time: { start: number; end?: number };
}

export interface FilePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: FilePartSource;
}

export type ToolState =
  | { status: "pending"; input: Record<string, unknown>; raw: string }
  | { status: "running"; input: Record<string, unknown>; title?: string; metadata?: Record<string, unknown>; time: { start: number } }
  | { status: "completed"; input: Record<string, unknown>; output: string; title: string; metadata: Record<string, unknown>; time: { start: number; end: number; compacted?: number }; attachments?: FilePart[] }
  | { status: "error"; input: Record<string, unknown>; error: string; metadata?: Record<string, unknown>; time: { start: number; end: number } };

export interface ToolPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "tool";
  callID: string;
  tool: string;
  state: ToolState;
  metadata?: Record<string, unknown>;
}

export interface StepStartPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "step-start";
  snapshot?: string;
}

export interface StepFinishPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "step-finish";
  reason: string;
  snapshot?: string;
  cost: number;
  tokens: TokenUsage;
}

export interface SnapshotPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "snapshot";
  snapshot: string;
}

export interface PatchPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "patch";
  hash: string;
  files: string[];
}

export interface AgentPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "agent";
  name: string;
  source?: { value: string; start: number; end: number };
}

export interface RetryPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "retry";
  attempt: number;
  error: Extract<MessageError, { name: "APIError" }>;
  time: { created: number };
}

export interface CompactionPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "compaction";
  auto: boolean;
  overflow?: boolean;
}

export type Part =
  | TextPart
  | SubtaskPart
  | ReasoningPart
  | FilePart
  | ToolPart
  | StepStartPart
  | StepFinishPart
  | SnapshotPart
  | PatchPart
  | AgentPart
  | RetryPart
  | CompactionPart;

// ── Todos ────────────────────────────────────────────────────────────────────

export interface Todo {
  content: string;
  status: string;
  priority: string;
}

// ── MCP ──────────────────────────────────────────────────────────────────────

export interface McpLocalConfig {
  type: "local";
  command: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

export interface McpRemoteConfig {
  type: "remote";
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
  oauth?: McpOAuthConfig | false;
  timeout?: number;
}

export interface McpOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  scope?: string;
}

export type MCPStatus =
  | { status: "connected" }
  | { status: "disabled" }
  | { status: "failed"; error: string }
  | { status: "needs_auth" }
  | { status: "needs_client_registration"; error: string };

export interface McpResource {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
  client: string;
}

// ── Tools ────────────────────────────────────────────────────────────────────

export type ToolIDs = string[];

export interface ToolListItem {
  id: string;
  description: string;
  parameters: unknown;
}

// ── Find ─────────────────────────────────────────────────────────────────────

export interface TextMatch {
  path: { text: string };
  lines: { text: string };
  line_number: number;
  absolute_offset: number;
  submatches: Array<{
    match: { text: string };
    start: number;
    end: number;
  }>;
}

export interface Symbol {
  name: string;
  kind: number;
  location: { uri: string; range: Range };
}

// ── Files ────────────────────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  absolute: string;
  type: "file" | "directory";
  ignored: boolean;
}

export interface FileContent {
  type: "text" | "binary";
  content: string;
  diff?: string;
  patch?: FilePatch;
  encoding?: "base64";
  mimeType?: string;
}

export interface FilePatch {
  oldFileName: string;
  newFileName: string;
  oldHeader?: string;
  newHeader?: string;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }>;
  index?: string;
}

export interface FileStatus {
  path: string;
  added: number;
  removed: number;
  status: "added" | "deleted" | "modified";
}

// ── Path ─────────────────────────────────────────────────────────────────────

export interface PathInfo {
  home: string;
  state: string;
  config: string;
  worktree: string;
  directory: string;
}

// ── VCS ──────────────────────────────────────────────────────────────────────

export interface VcsInfo {
  branch: string;
}

// ── Commands ─────────────────────────────────────────────────────────────────

export interface Command {
  name: string;
  description?: string;
  agent?: string;
  model?: string;
  source?: "command" | "mcp" | "skill";
  template: string;
  subtask?: boolean;
  hints: string[];
}

// ── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  worktree: string;
  vcs?: "git";
  name?: string;
  icon?: { url?: string; override?: string; color?: string };
  commands?: { start?: string };
  time: { created: number; updated: number; initialized?: number };
  sandboxes: string[];
}

export interface ProjectUpdatePayload {
  name?: string;
  icon?: { url?: string; override?: string; color?: string };
  commands?: { start?: string };
}

// ── PTY ──────────────────────────────────────────────────────────────────────

export interface Pty {
  id: string;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  status: "running" | "exited";
  pid: number;
}

export interface PtyCreatePayload {
  command?: string;
  args?: string[];
  cwd?: string;
  title?: string;
  env?: Record<string, string>;
}

export interface PtyUpdatePayload {
  title?: string;
  size?: { rows: number; cols: number };
}

// ── Worktrees ────────────────────────────────────────────────────────────────

export interface Worktree {
  name: string;
  branch: string;
  directory: string;
}

export interface WorktreeCreateInput {
  name?: string;
  startCommand?: string;
}

export interface WorktreeRemoveInput {
  directory: string;
}

export interface WorktreeResetInput {
  directory: string;
}

// ── Workspaces ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  branch: string | null;
  projectID: string;
  config: { directory: string; type: "worktree" };
}

export interface WorkspaceCreatePayload {
  branch: string | null;
  config?: { directory: string; type: "worktree" };
}

// ── LSP ──────────────────────────────────────────────────────────────────────

export interface LSPStatus {
  id: string;
  name: string;
  root: string;
  status: "connected" | "error";
}

// ── Formatter ────────────────────────────────────────────────────────────────

export interface FormatterStatus {
  name: string;
  extensions: string[];
  enabled: boolean;
}

// ── Log ──────────────────────────────────────────────────────────────────────

export interface LogEntry {
  service: string;
  level: "debug" | "info" | "error" | "warn";
  message: string;
  extra?: Record<string, unknown>;
}

// ── Config Providers (the /config/providers endpoint) ────────────────────────

export interface ConfigProviders {
  providers: Provider[];
  default: Record<string, string>;
}

// ── Events (SSE) ─────────────────────────────────────────────────────────────

export interface GlobalEvent {
  directory: string;
  payload: OpenCodeEvent;
}

/**
 * Discriminated union of every event type the server can emit.
 * Each variant carries a `type` discriminant and a `properties` payload.
 */
export type OpenCodeEvent =
  | { type: "server.connected"; properties: Record<string, never> }
  | { type: "global.disposed"; properties: Record<string, never> }
  | { type: "installation.updated"; properties: { version: string } }
  | { type: "installation.update-available"; properties: { version: string } }
  | { type: "project.updated"; properties: Project }
  | { type: "server.instance.disposed"; properties: { directory: string } }
  | { type: "file.edited"; properties: { file: string } }
  | { type: "worktree.ready"; properties: { name: string; branch: string } }
  | { type: "worktree.failed"; properties: { message: string } }
  | { type: "lsp.client.diagnostics"; properties: { serverID: string; path: string } }
  | { type: "permission.asked"; properties: PermissionRequest }
  | { type: "permission.replied"; properties: { sessionID: string; requestID: string; reply: PermissionReply } }
  | { type: "session.status"; properties: { sessionID: string; status: SessionStatusType } }
  | { type: "session.idle"; properties: { sessionID: string } }
  | { type: "question.asked"; properties: QuestionRequest }
  | { type: "question.replied"; properties: { sessionID: string; requestID: string; answers: QuestionAnswer[] } }
  | { type: "question.rejected"; properties: { sessionID: string; requestID: string } }
  | { type: "todo.updated"; properties: { sessionID: string; todos: Todo[] } }
  | { type: "pty.created"; properties: { info: Pty } }
  | { type: "pty.updated"; properties: { info: Pty } }
  | { type: "pty.exited"; properties: { id: string; exitCode: number } }
  | { type: "pty.deleted"; properties: { id: string } }
  | { type: "file.watcher.updated"; properties: { file: string; event: "add" | "change" | "unlink" } }
  | { type: "mcp.tools.changed"; properties: { server: string } }
  | { type: "mcp.browser.open.failed"; properties: { mcpName: string; url: string } }
  | { type: "lsp.updated"; properties: Record<string, never> }
  | { type: "workspace.ready"; properties: { name: string } }
  | { type: "workspace.failed"; properties: { message: string } }
  | { type: "vcs.branch.updated"; properties: { branch?: string } }
  | { type: "command.executed"; properties: { name: string; sessionID: string; arguments: string; messageID: string } }
  | { type: "message.updated"; properties: { info: Message } }
  | { type: "message.removed"; properties: { sessionID: string; messageID: string } }
  | { type: "message.part.updated"; properties: { part: Part } }
  | { type: "message.part.delta"; properties: { sessionID: string; messageID: string; partID: string; field: string; delta: string } }
  | { type: "tool.call"; properties: BridgeToolCallEventProperties }
  | { type: "tool.call.updated"; properties: BridgeToolCallUpdatedEventProperties }
  | { type: "permission.requested"; properties: BridgePermissionRequestedEvent }
  | { type: "message.part.removed"; properties: { sessionID: string; messageID: string; partID: string } }
  | { type: "session.compacted"; properties: { sessionID: string } }
  | { type: "session.created"; properties: { info: Session } }
  | { type: "session.updated"; properties: { info: Session } }
  | { type: "session.deleted"; properties: { info: Session } }
  | { type: "session.diff"; properties: { sessionID: string; diff: FileDiff[] } }
  | { type: "session.error"; properties: { sessionID?: string; error?: MessageError } };

// ── Find params ──────────────────────────────────────────────────────────────

export interface FindFilesParams extends InstanceParams {
  query: string;
  dirs?: "true" | "false";
  type?: "file" | "directory";
  limit?: number;
}

export interface FindTextParams extends InstanceParams {
  pattern: string;
}

export interface FindSymbolsParams extends InstanceParams {
  query: string;
}

// ── Tool list params ─────────────────────────────────────────────────────────

export interface ToolListParams extends InstanceParams {
  provider: string;
  model: string;
}


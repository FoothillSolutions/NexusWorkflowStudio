import type { Stats } from "node:fs";

export interface HealthInfo {
  healthy: true;
  version: string;
}

export interface Model {
  id: string;
  providerID: string;
  api: { id: string; url: string; npm: string };
  name: string;
  family?: string;
  capabilities: {
    temperature: boolean;
    reasoning: boolean;
    attachment: boolean;
    toolcall: boolean;
    input: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean };
    output: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean };
    interleaved: boolean;
  };
  cost: { input: number; output: number; cache: { read: number; write: number } };
  limit: { output: number; context?: number; input?: number };
  status: "active" | "alpha" | "beta" | "deprecated";
  options: Record<string, unknown>;
  headers: Record<string, string>;
  release_date: string;
}

export interface Provider {
  id: string;
  name: string;
  source: "api" | "config" | "custom" | "env";
  env: string[];
  options: Record<string, unknown>;
  models: Record<string, Model>;
}

export interface ConfigProviders {
  providers: Provider[];
  default: Record<string, string>;
}

export interface ToolListItem {
  id: string;
  description: string;
  parameters: unknown;
}

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

export interface Session {
  id: string;
  slug: string;
  projectID: string;
  directory: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
  };
}

export type PromptPartInput = {
  id?: string;
  type: "text";
  text: string;
};

export interface PromptPayload {
  messageID?: string;
  model?: { providerID: string; modelID: string };
  agent?: string;
  noReply?: boolean;
  tools?: Record<string, boolean>;
  format?: { type: string };
  system?: string;
  variant?: string;
  parts: PromptPartInput[];
}

export interface UserMessage {
  id: string;
  sessionID: string;
  role: "user";
  time: { created: number };
  model?: { providerID: string; modelID: string };
  system?: string;
  tools?: Record<string, boolean>;
}

export interface AssistantMessage {
  id: string;
  sessionID: string;
  role: "assistant";
  time: { created: number; completed?: number };
  parentID: string;
  modelID: string;
  providerID: string;
  mode: string;
  agent: string;
  path: { cwd: string; root: string };
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  finish?: string;
  error?: { name: string; data?: { message?: string } };
}

export type Message = UserMessage | AssistantMessage;

export interface TextPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "text";
  text: string;
}

export type Part = TextPart;

export interface MessageWithParts {
  info: Message;
  parts: Part[];
}

export type OpenCodeEvent =
  | { type: "message.updated"; properties: { info: Message } }
  | { type: "message.part.delta"; properties: { sessionID: string; messageID: string; partID: string; field: string; delta: string } }
  | { type: "session.updated"; properties: { info: Session } }
  | { type: "tool.call"; properties: { sessionID?: string; id?: string; callID?: string; name?: string; tool?: string; status?: string; input?: unknown } }
  | { type: "tool.call.updated"; properties: { sessionID?: string; id?: string; callID?: string; name?: string; tool?: string; status?: string; input?: unknown; output?: unknown; error?: string } }
  | { type: "permission.requested"; properties: { sessionID?: string; requestId?: string; id?: string; title?: string; description?: string; options?: Array<{ id: string; label: string; description?: string; outcome?: string }> } }
  | { type: "session.idle"; properties: { sessionID: string } }
  | { type: "session.error"; properties: { sessionID?: string; error?: { name: string; data?: { message?: string } } } };

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
  encoding?: "base64";
  mimeType?: string;
}

export interface FileStatus {
  path: string;
  added: number;
  removed: number;
  status: "added" | "deleted" | "modified";
}

export type ACPTransportProtocol = "content-length" | "newline";

export interface BridgeConfig {
  adapterMode: "mock" | "stdio" | "acp";
  selectedTool: string | null;
  host: string;
  port: number;
  serverIdleTimeoutSeconds: number;
  corsOrigin: string;
  version: string;
  projectDirs: string[];
  allowArbitraryDirectories: boolean;
  defaultProviderId: string;
  defaultProviderName: string;
  defaultModelId: string;
  defaultModelName: string;
  defaultTools: string[];
  agentCommand: string | null;
  agentArgs: string[];
  agentCwd: string | null;
  acpProtocol: ACPTransportProtocol;
  acpProtocolVersion: number;
  mockStreamDelayMs: number;
  maxFileReadBytes: number;
}

export interface GenerateTextRequest {
  session: Session;
  project: Project;
  payload: PromptPayload;
  signal: AbortSignal;
}

export interface ACPAdapter {
  getHealth(): Promise<HealthInfo>;
  getConfigProviders(): Promise<ConfigProviders>;
  listCommands(input: { project: Project }): Promise<Command[]>;
  listTools(input: { provider: string; model: string; project: Project }): Promise<ToolListItem[]>;
  getMcpStatus(input: { project: Project }): Promise<Record<string, MCPStatus>>;
  listResources(input: { project: Project }): Promise<Record<string, McpResource>>;
  generateText(request: GenerateTextRequest): AsyncIterable<string>;
  dispose?(): Promise<void> | void;
}

export interface SessionRecord {
  session: Session;
  project: Project;
  messages: MessageWithParts[];
  abortController: AbortController | null;
  status: "idle" | "busy";
}

export interface ResolvedDirectory {
  absolutePath: string;
  stats: Stats;
}



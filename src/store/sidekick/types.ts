import type { z } from "zod/v4";

export type SidekickRole = "user" | "assistant" | "tool" | "acp-tool" | "permission";
export type SidekickStatus = "idle" | "creating-session" | "streaming" | "running-tools" | "awaiting-approval" | "awaiting-permission" | "error";
export type ToolStatus = "pending" | "awaiting-approval" | "running" | "done" | "error" | "denied" | "skipped";
export type PermissionStatus = "pending" | "resolved" | "expired" | "cancelled" | "error";

export interface ParsedActionCall { id: string; name: string; args: unknown; raw: string; error?: string }
export interface ToolCall { id: string; name: string; args: unknown; destructive?: boolean; status: ToolStatus }
export interface ToolResult { id: string; name: string; ok: boolean; result?: unknown; error?: { code: string; message: string } }
export interface PendingApproval { call: ToolCall; queue: ParsedActionCall[]; allowAlwaysAvailable: boolean }
export type AllowList = Record<string, true>;
export interface AcpPermissionOption { id: string; label: string; description?: string; outcome?: "allow_once" | "allow_always" | "deny" }
export interface AcpPermissionRequest { requestId: string; sessionId?: string; title?: string; description?: string; options: AcpPermissionOption[]; status: PermissionStatus }
export interface AcpToolCall { id: string; name: string; status?: string; input?: unknown; output?: unknown; error?: string }

export type SidekickMessage =
  | { id: string; role: "user" | "assistant"; kind: "text"; text: string; createdAt: number }
  | { id: string; role: "tool"; kind: "action"; call: ToolCall; result?: ToolResult; createdAt: number }
  | { id: string; role: "acp-tool"; kind: "acp-tool"; tool: AcpToolCall; createdAt: number }
  | { id: string; role: "permission"; kind: "permission"; request: AcpPermissionRequest; createdAt: number };

export interface PanelPosition { x: number; y: number }
export interface ToolDefinition<Schema extends z.ZodType = z.ZodType> { name: string; description: string; schema: Schema; destructive?: boolean; write?: boolean; handler: (args: z.infer<Schema>) => ToolResult | Promise<ToolResult> }

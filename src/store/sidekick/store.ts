"use client";
import { create } from "zustand";
import type { AcpPermissionRequest, AllowList, PanelPosition, ParsedActionCall, PendingApproval, PermissionStatus, SidekickMessage, SidekickStatus, ToolResult, ToolStatus } from "./types";
import { sendSidekickTurn, restoreSidekickHistory, initSidekickRunner } from "./runner";
import { useOpenCodeStore } from "@/store/opencode";

const SESSION_KEY = "nexus.sidekick.sessionId";
const POSITION_KEY = "nexus.sidekick.panelPosition";
const loadSession = () => typeof window === "undefined" ? null : localStorage.getItem(SESSION_KEY);
const loadPos = (): PanelPosition | null => { if (typeof window === "undefined") return null; try { return JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null") as PanelPosition | null; } catch { return null; } };

interface SidekickState {
  messages: SidekickMessage[]; status: SidekickStatus; sessionId: string | null; panelOpen: boolean; panelCollapsed: boolean; panelPosition: PanelPosition | null; pendingApproval: PendingApproval | null; allowList: AllowList; error: string | null; _abortController: AbortController | null; _approvalResolver: ((v: "once" | "always" | "deny") => void) | null;
  send: (text: string) => Promise<void>; cancel: () => Promise<void>; newConversation: () => Promise<void>; togglePanel: () => void; setPanelOpen: (open: boolean) => void; setPanelCollapsed: (collapsed: boolean) => void; setPanelPosition: (position: PanelPosition) => void; approve: (always?: boolean) => void; deny: () => void; respondToAcpPermission: (requestId: string, outcome: string, optionId?: string) => Promise<void>; init: () => void;
  appendMessage: (message: SidekickMessage) => void; appendAssistantDelta: (id: string, delta: string) => void; setAssistantText: (id: string, text: string) => void; upsertAction: (call: ParsedActionCall, status: ToolStatus) => void; completeAction: (call: ParsedActionCall, result: ToolResult) => void; awaitApproval: (call: ParsedActionCall, queue: ParsedActionCall[]) => Promise<"once" | "always" | "deny">; upsertAcpTool: (payload: unknown) => void; addAcpPermission: (payload: unknown) => void;
}
export const useSidekickStore = create<SidekickState>((set, get) => ({
  messages: [], status: "idle", sessionId: loadSession(), panelOpen: false, panelCollapsed: false, panelPosition: loadPos(), pendingApproval: null, allowList: {}, error: null, _abortController: null, _approvalResolver: null,
  send: (text) => sendSidekickTurn(text),
  cancel: async () => { const { _abortController, sessionId } = get(); _abortController?.abort(); const client = useOpenCodeStore.getState().client; if (client && sessionId) await client.sessions.abort(sessionId).catch(() => false); set({ status: "idle", _abortController: null }); },
  newConversation: async () => { const { sessionId } = get(); const client = useOpenCodeStore.getState().client; if (client && sessionId) await client.sessions.delete(sessionId).catch(() => false); if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY); set({ messages: [], sessionId: null, allowList: {}, pendingApproval: null, error: null, status: "idle" }); },
  togglePanel: () => { const next = !get().panelOpen; set({ panelOpen: next, panelCollapsed: false }); if (next) { get().init(); void restoreSidekickHistory(); } },
  setPanelOpen: (panelOpen) => { set({ panelOpen }); if (panelOpen) { get().init(); void restoreSidekickHistory(); } },
  setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
  setPanelPosition: (panelPosition) => { if (typeof window !== "undefined") localStorage.setItem(POSITION_KEY, JSON.stringify(panelPosition)); set({ panelPosition }); },
  approve: (always) => { get()._approvalResolver?.(always ? "always" : "once"); set({ pendingApproval: null, _approvalResolver: null, status: "running-tools" }); },
  deny: () => { get()._approvalResolver?.("deny"); set({ pendingApproval: null, _approvalResolver: null, status: "running-tools" }); },
  respondToAcpPermission: async (requestId, outcome, optionId) => { const client = useOpenCodeStore.getState().client; const sessionId = get().sessionId; if (client && sessionId) await client.permissions.respondToSession(sessionId, { requestId, outcome, optionId }); set((s) => ({ messages: s.messages.map((m) => m.kind === "permission" && m.request.requestId === requestId ? { ...m, request: { ...m.request, status: "resolved" as PermissionStatus } } : m) })); },
  init: () => initSidekickRunner(),
  appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  appendAssistantDelta: (id, delta) => set((s) => ({ messages: s.messages.map((m) => m.id === id && m.kind === "text" ? { ...m, text: m.text + delta } : m) })),
  setAssistantText: (id, text) => set((s) => ({ messages: s.messages.map((m) => m.id === id && m.kind === "text" ? { ...m, text } : m) })),
  upsertAction: (call, status) => set((s) => ({ messages: s.messages.some((m) => m.id === call.id) ? s.messages.map((m) => m.id === call.id && m.kind === "action" ? { ...m, call: { ...m.call, status } } : m) : [...s.messages, { id: call.id, role: "tool", kind: "action", createdAt: Date.now(), call: { id: call.id, name: call.name, args: call.args, status } }] })),
  completeAction: (call, result) => set((s) => ({ messages: s.messages.map((m) => m.id === call.id && m.kind === "action" ? { ...m, call: { ...m.call, status: result.ok ? "done" : "error" }, result } : m) })),
  awaitApproval: (call, queue) => new Promise((resolve) => set({ pendingApproval: { call: { id: call.id, name: call.name, args: call.args, destructive: true, status: "awaiting-approval" }, queue, allowAlwaysAvailable: true }, _approvalResolver: resolve, status: "awaiting-approval" })),
  upsertAcpTool: (payload) => { const p = payload as { id?: string; callID?: string; name?: string; tool?: string; status?: string; input?: unknown; output?: unknown; error?: string }; const id = p.id ?? p.callID ?? crypto.randomUUID(); set((s) => ({ messages: s.messages.some((m) => m.id === id) ? s.messages.map((m) => m.id === id && m.kind === "acp-tool" ? { ...m, tool: { ...m.tool, ...p, id, name: p.name ?? p.tool ?? m.tool.name } } : m) : [...s.messages, { id, role: "acp-tool", kind: "acp-tool", createdAt: Date.now(), tool: { id, name: p.name ?? p.tool ?? "ACP tool", status: p.status, input: p.input, output: p.output, error: p.error } }] })); },
  addAcpPermission: (payload) => { const p = payload as { requestId?: string; id?: string; sessionID?: string; title?: string; description?: string; options?: Array<{ id: string; label: string; description?: string; outcome?: "allow_once" | "allow_always" | "deny" }> }; const requestId = p.requestId ?? p.id ?? crypto.randomUUID(); const request: AcpPermissionRequest = { requestId, sessionId: p.sessionID, title: p.title ?? "Permission requested", description: p.description, options: p.options ?? [{ id: "allow_once", label: "Allow once", outcome: "allow_once" }, { id: "deny", label: "Deny", outcome: "deny" }], status: "pending" }; set((s) => ({ status: "awaiting-permission", messages: [...s.messages, { id: requestId, role: "permission", kind: "permission", request, createdAt: Date.now() }] })); },
}));
useSidekickStore.subscribe((s) => { if (typeof window !== "undefined") { if (s.sessionId) localStorage.setItem(SESSION_KEY, s.sessionId); else localStorage.removeItem(SESSION_KEY); } });

import { useOpenCodeStore } from "@/store/opencode";
import { subscribeToConnectorChange } from "@/store/opencode/connector-bus";
import { buildViewSnapshot, buildToolResultMessage } from "./context";
import { buildSidekickSystemPrompt } from "./system-prompt";
import { dispatchTool, isDestructiveTool } from "./tools";
import { StreamingActionParser } from "./streaming-action-parser";
import type { ParsedActionCall, SidekickMessage, ToolResult } from "./types";
import { useSidekickStore } from "./store";

const TIMEOUT = 120_000;
const textId = () => `sidekick_${crypto.randomUUID()}`;

export async function ensureSidekickSession(): Promise<string> {
  const state = useSidekickStore.getState();
  if (state.sessionId) return state.sessionId;
  const client = useOpenCodeStore.getState().client;
  if (!client) throw new Error("OpenCode / ACP bridge is not connected");
  useSidekickStore.setState({ status: "creating-session", error: null });
  const session = await client.sessions.create({ title: "Nexus Side-kick", permissionMode: "forward" }, { timeout: TIMEOUT });
  useSidekickStore.setState({ sessionId: session.id, status: "idle" });
  return session.id;
}

export async function restoreSidekickHistory(): Promise<void> {
  const { sessionId } = useSidekickStore.getState();
  const client = useOpenCodeStore.getState().client;
  if (!sessionId || !client) return;
  try {
    const history = await client.messages.list(sessionId, 50);
    const messages: SidekickMessage[] = history.flatMap((m) => {
      const text = m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
      if (!text) return [];
      return [{ id: m.info.id, role: m.info.role, kind: "text", text, createdAt: m.info.time.created }] as SidekickMessage[];
    });
    useSidekickStore.setState({ messages });
  } catch {
    useSidekickStore.setState({ sessionId: null });
  }
}

async function runActions(calls: ParsedActionCall[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const call of calls) {
    const destructive = isDestructiveTool(call.name);
    if (destructive && !useSidekickStore.getState().allowList[call.name]) {
      useSidekickStore.getState().appendMessage({ id: call.id, role: "tool", kind: "action", createdAt: Date.now(), call: { id: call.id, name: call.name, args: call.args, destructive, status: "awaiting-approval" } });
      const decision = await useSidekickStore.getState().awaitApproval(call, calls.slice(calls.indexOf(call) + 1));
      if (decision === "deny") {
        results.push({ id: call.id, name: call.name, ok: false, error: { code: "denied", message: "User denied action" } });
        for (const skipped of calls.slice(calls.indexOf(call) + 1).filter((c) => isDestructiveTool(c.name))) results.push({ id: skipped.id, name: skipped.name, ok: false, error: { code: "skipped_after_deny", message: "Skipped after destructive action was denied" } });
        break;
      }
      if (decision === "always") useSidekickStore.setState((s) => ({ allowList: { ...s.allowList, [call.name]: true } }));
    }
    useSidekickStore.getState().upsertAction(call, "running");
    const result = await dispatchTool(call);
    results.push(result);
    useSidekickStore.getState().completeAction(call, result);
  }
  return results;
}

export async function sendSidekickTurn(text: string, followUp = false): Promise<void> {
  const client = useOpenCodeStore.getState().client;
  if (!client) { useSidekickStore.setState({ status: "error", error: "OpenCode / ACP bridge is not connected" }); return; }
  const abort = new AbortController();
  useSidekickStore.setState({ status: "streaming", error: null, _abortController: abort });
  if (!followUp) useSidekickStore.getState().appendMessage({ id: textId(), role: "user", kind: "text", text, createdAt: Date.now() });
  try {
    const sessionId = await ensureSidekickSession();
    const assistantId = textId();
    useSidekickStore.getState().appendMessage({ id: assistantId, role: "assistant", kind: "text", text: "", createdAt: Date.now() });
    const parser = new StreamingActionParser();
    const calls: ParsedActionCall[] = [];
    const events = client.events.subscribe({ signal: abort.signal });
    let next = events.next();
    await client.messages.sendAsync(sessionId, { system: buildSidekickSystemPrompt(), parts: [{ type: "text", text: `${buildViewSnapshot()}\n\n${text}` }] }, { signal: abort.signal, timeout: TIMEOUT });
    while (true) {
      const { value, done } = await next;
      if (done || abort.signal.aborted) break;
      next = events.next();
      if (!value) continue;
      if ("properties" in value && (value.properties as { sessionID?: string }).sessionID && (value.properties as { sessionID?: string }).sessionID !== sessionId) continue;
      if (value.type === "message.part.delta" && value.properties.field === "text") {
        useSidekickStore.getState().appendAssistantDelta(assistantId, value.properties.delta);
        calls.push(...parser.push(value.properties.delta).calls);
      } else if (value.type === "message.part.updated" && value.properties.part.type === "text") {
        useSidekickStore.getState().setAssistantText(assistantId, value.properties.part.text);
      } else if (value.type === "tool.call") {
        useSidekickStore.getState().upsertAcpTool(value.properties);
      } else if (value.type === "tool.call.updated") {
        useSidekickStore.getState().upsertAcpTool(value.properties);
      } else if (value.type === "permission.requested") {
        useSidekickStore.getState().addAcpPermission(value.properties);
      } else if (value.type === "session.error") {
        throw new Error(value.properties.error?.data?.message ?? value.properties.error?.name ?? "Session error");
      } else if (value.type === "session.idle") break;
    }
    useSidekickStore.setState({ status: calls.length ? "running-tools" : "idle" });
    const results = await runActions(calls);
    useSidekickStore.setState({ status: "idle", _abortController: null });
    if (results.length) await sendSidekickTurn(buildToolResultMessage(results), true);
  } catch (error) {
    if (abort.signal.aborted) useSidekickStore.setState({ status: "idle", _abortController: null });
    else useSidekickStore.setState({ status: "error", error: error instanceof Error ? error.message : String(error), _abortController: null });
  }
}

let subscribed = false;
export function initSidekickRunner(): void {
  if (subscribed) return;
  subscribed = true;
  subscribeToConnectorChange((reason) => {
    useSidekickStore.setState({ sessionId: null, messages: [], allowList: {}, error: `Side-kick conversation reset after connector ${reason}.`, status: "idle" });
  });
}

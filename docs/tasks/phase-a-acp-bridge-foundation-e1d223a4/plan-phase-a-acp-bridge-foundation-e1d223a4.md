# feature: Phase A ACP Bridge Foundation

## Metadata
adw_id: `e1d223a4`
document_description: `Plan — Phase A: ACP Bridge (Foundation)`

## Description
The task document captures the remaining Phase A foundation work needed after the `feat/nexus-acp-bridge` branch. The bridge already runs as a separate Bun HTTP/SSE server and exposes an OpenCode-shaped API that Nexus can consume through the existing `OpenCodeClient`. The remaining work is to make that bridge suitable for the upcoming AI side-kick UX by surfacing ACP tool-call activity, supporting forwarded permission prompts instead of unconditional auto-approval, and preserving the Nexus assistant `messageID` association for tool events.

Complexity assessment: `complex`. This work crosses the bridge package API, ACP adapter event translation, HTTP route handling, config parsing, browser-side OpenCode event types, and tests.

## Objective
Implement the Phase A bridge gaps so the ACP bridge can:

- emit OpenCode-compatible SSE events for ACP `tool_call` and `tool_call_update` updates;
- include `sessionID`, `messageID`, and `callID` in tool-call events so the future side-kick can render tool cards in the correct assistant-message slot;
- support permission handling in both safe default `auto` mode and side-kick-ready `forward` mode;
- expose `POST /session/:id/permission` to resolve forwarded ACP permission requests;
- keep existing workflow generation and prompt generation behavior unchanged for consumers that ignore the new events.

## Problem Statement
The bridge currently converts ACP text chunks into OpenCode-style text deltas, but drops tool-call and permission context. ACP `session/update` notifications for `tool_call` / `tool_call_update` are not exposed to the browser, and `session/request_permission` is silently auto-approved. That prevents the side-kick from showing collapsible tool cards or allowing users to approve/deny risky actions.

## Solution Statement
Extend the bridge's OpenCode-compatible event model and ACP adapter plumbing while preserving existing defaults. Add typed event variants for tool calls and permission requests; pass an event sink and assistant `messageID` from the HTTP server into the adapter during generation; track ACP session ↔ Nexus session associations; support per-session permission mode with config defaults; route permission replies back to pending JSON-RPC reverse requests; and validate behavior with bridge unit/integration tests.

## Code Patterns to Follow
Reference implementations:

- `packages/nexus-acp-bridge/src/adapters/acp-protocol.ts` — current source of truth for ACP JSON-RPC initialization, `session/new`, `session/prompt`, command discovery, reverse `fs/*` handlers, and current auto-permission behavior.
- `packages/nexus-acp-bridge/src/server/http-server.ts` — existing OpenCode-shaped REST/SSE routes, `EventBroker.publish()`, `runPromptAsync()`, zod request schemas, CORS handling, and session lifecycle.
- `packages/nexus-acp-bridge/src/types.ts` — bridge wire-type and interface definitions that should be updated before implementation code.
- `packages/nexus-acp-bridge/src/config.ts` — established CLI/env parsing pattern (`readEnv`, `readNumber`, `readBoolean`, `parseCliArgs`, bundled defaults, presets).
- `packages/nexus-acp-bridge/src/__tests__/acp-protocol-adapter.test.ts` — fake ACP client pattern for reverse handler and session update tests.
- `packages/nexus-acp-bridge/src/__tests__/server.test.ts` — Bun server integration-test pattern using `port: 0`, `fetch`, and cleanup in `afterEach`.
- `src/lib/opencode/types.ts` — browser OpenCode event union that must stay compatible with bridge-emitted SSE payloads.
- `src/lib/opencode/services/permissions.ts` and `src/lib/opencode/services/sessions.ts` — existing service wrappers to follow if adding a client helper for the bridge permission endpoint.

Exhaustive pattern research performed:

- `OpenCodeEvent` occurrences:
  - `packages/nexus-acp-bridge/src/server/http-server.ts`: 4
  - `packages/nexus-acp-bridge/src/types.ts`: 1
  - `src/lib/opencode/services/events.ts`: 3
  - `src/lib/opencode/types.ts`: 2
- `session/request_permission` occurrences:
  - `packages/nexus-acp-bridge/README.md`: 1
  - `packages/nexus-acp-bridge/src/adapters/acp-protocol.ts`: 1
  - `packages/nexus-acp-bridge/src/__tests__/acp-protocol-adapter.test.ts`: 2
- `tool_call` / `tool_call_update` occurrences:
  - `src/lib/opencode/types.ts`: 1
- `permission` / `permissions` route/service occurrences:
  - `src/lib/opencode/services/index.ts`: 1
  - `packages/nexus-acp-bridge/src/adapters/acp-protocol.ts`: 1
  - `src/lib/opencode/services/permissions.ts`: 7
  - `packages/nexus-acp-bridge/src/__tests__/acp-protocol-adapter.test.ts`: 3
  - `src/lib/opencode/index.ts`: 2
  - `src/lib/opencode/types.ts`: 9

## Relevant Files
Use these files to complete the task:

- `CLAUDE.md` — project-level coding rules: use Bun, keep OpenCode integration optional, preserve browser/localStorage assumptions, avoid new backend assumptions outside existing bridge package.
- `packages/nexus-acp-bridge/CLAUDE.md` — package-specific rules: keep all env/CLI resolution in `config.ts`, keep `fs/*` sandboxing, preserve abortable streaming, expose public API through `src/index.ts`.
- `.app_config.yaml` — validation command source for build/lint/typecheck and confirms this is primarily a frontend app with a bridge package.
- `README.md` — user-facing ACP bridge behavior and commands; update if new bridge flags/env vars become user-facing.
- `package.json` — root scripts including `test:bridge`, `typecheck:bridge`, `typecheck`, `lint`, and `build`.
- `packages/nexus-acp-bridge/package.json` — bridge package test/typecheck scripts.
- `packages/nexus-acp-bridge/src/types.ts` — add event variants, permission-mode types, request/reply payload types, adapter interface updates, and session record metadata.
- `packages/nexus-acp-bridge/src/config.ts` — parse `--permission-mode`, `NEXUS_ACP_BRIDGE_PERMISSION_MODE`, and optional timeout configuration with defaults.
- `packages/nexus-acp-bridge/src/adapters/acp-protocol.ts` — emit tool events from ACP `session/update`, map ACP sessions to Nexus sessions/messages, forward permission requests when configured, resolve/cancel pending permission requests.
- `packages/nexus-acp-bridge/src/server/http-server.ts` — accept per-session permission mode in `POST /session`, pass generation event sink/message context to adapter, add `POST /session/:id/permission`, publish new SSE events.
- `packages/nexus-acp-bridge/src/__tests__/acp-protocol-adapter.test.ts` — add adapter tests for tool events, auto permissions, forwarded permissions, and forwarded permission timeout.
- `packages/nexus-acp-bridge/src/__tests__/server.test.ts` — add server tests for session permission mode parsing, permission route behavior, and SSE delivery of new events.
- `packages/nexus-acp-bridge/src/__tests__/test-helpers.ts` — update `makeBridgeConfig()` and `makeGenerateTextRequest()` defaults for new config/request fields.
- `src/lib/opencode/types.ts` — mirror bridge event union additions so browser consumers can type side-kick events safely.
- `src/lib/opencode/services/permissions.ts` — optionally add a bridge-specific helper for `POST /session/:id/permission`, while preserving existing OpenCode permission methods.
- `src/lib/opencode/services/sessions.ts` — update `SessionCreatePayload` usage/types if the side-kick will create sessions with `permissionMode: "forward"` through the regular session service.
- `.env.example` — document new bridge permission environment variables if they are intended for users.
- `packages/nexus-acp-bridge/README.md` — replace the current auto-approval-only statement with the new default/forward behavior and endpoint/flag examples.
- `docs/tasks/conditional_docs.md` — reviewed; no additional conditional documentation applies because this task does not touch Brain persistence or workspace foundation routes.

### New Files
No new source files are required. Prefer modifying the existing bridge package and OpenCode type/service files.

## Implementation Plan
### Phase 1: Foundation
Define shared types and configuration first so later implementation code is strongly typed. Add `PermissionMode`, bridge permission request/reply payloads, `ToolCall` event variants, and adapter request/reply hooks in `packages/nexus-acp-bridge/src/types.ts`. Extend config parsing with safe defaults (`auto`, timeout around 60 seconds) and update test helpers.

### Phase 2: Core Implementation
Update `ACPProtocolAdapter` so it translates ACP `tool_call` and `tool_call_update` updates into OpenCode-style events and manages pending forwarded permissions. Add maps for ACP session → Nexus session/message context and pending permission resolvers. In `auto` mode, preserve the existing behavior. In `forward` mode, emit `permission.requested`, park the JSON-RPC response promise, and resolve it through a new adapter method called by the HTTP route.

### Phase 3: Integration
Wire the HTTP server to store per-session permission mode, pass assistant `messageID` and an event publisher into `adapter.generateText()`, add `POST /session/:id/permission`, and mirror event types in the frontend OpenCode union. Update tests and user-facing docs/env examples.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Confirm Baseline and Branch State
- Verify the bridge package files listed in the task document exist in this worktree.
- Run `git status --short` and avoid overwriting unrelated local changes.
- Review `packages/nexus-acp-bridge/src/types.ts`, `src/config.ts`, `src/adapters/acp-protocol.ts`, `src/server/http-server.ts`, and current bridge tests before editing.

### 2. Add Shared Bridge Types
- In `packages/nexus-acp-bridge/src/types.ts`, add:
  - `export type PermissionMode = "auto" | "forward"`;
  - `export type PermissionOutcome = { outcome: "selected"; optionId: string } | { outcome: "cancelled" }` or equivalent matching ACP response shape;
  - `ToolCallEvent` and `ToolCallUpdatedEvent` variants with `sessionID`, `messageID`, `callID`, `title`, optional `kind`, optional `rawInput`, `status`, optional `rawOutput`, and optional `error`;
  - `PermissionRequestedEvent` with `sessionID`, `requestID`, `toolCall: { title: string; kind?: string }`, and `options: Array<{ name: string; kind: string; optionId: string }>`;
  - request/reply payload types for `POST /session/:id/permission`.
- Extend the bridge `OpenCodeEvent` union with:
  - `{ type: "tool.call"; properties: ... }`;
  - `{ type: "tool.call.updated"; properties: ... }`;
  - `{ type: "permission.requested"; properties: ... }`.
- Extend `BridgeConfig` with `permissionMode: PermissionMode` and `permissionTimeoutMs: number`.
- Extend `GenerateTextRequest` with enough context for event translation, for example:
  - `assistantMessageID: string`;
  - `permissionMode: PermissionMode`;
  - `publishEvent?: (event: OpenCodeEvent) => void`.
- Extend `ACPAdapter` with an optional or required permission response method, for example:
  - `respondToPermission?(input: { sessionID: string; requestID: string; outcome: PermissionOutcome }): Promise<boolean>`.
- Extend `SessionRecord` with `permissionMode: PermissionMode`.

### 3. Parse Permission Config Defaults
- In `packages/nexus-acp-bridge/src/config.ts`, update `parseCliArgs()` to recognize `--permission-mode` and `--permission-mode=<value>`.
- Accept only `auto` or `forward`; default to `auto` for backwards compatibility.
- Add `NEXUS_ACP_BRIDGE_PERMISSION_MODE` as the env fallback.
- Add `NEXUS_ACP_BRIDGE_PERMISSION_TIMEOUT_MS` with a default around `60_000`, clamped to a sane positive value.
- Ensure CLI values keep the same highest-precedence pattern as `--port`, `--host`, and `--cors`.
- Add or update config tests in `packages/nexus-acp-bridge/src/__tests__/config.test.ts` for CLI/env/default behavior.

### 4. Update Test Helpers
- In `packages/nexus-acp-bridge/src/__tests__/test-helpers.ts`, add defaults for `permissionMode: "auto"` and `permissionTimeoutMs: 60_000` in `makeBridgeConfig()`.
- Add defaults for `assistantMessageID`, `permissionMode`, and a no-op or capturable `publishEvent` in `makeGenerateTextRequest()` as needed.
- Keep helper overrides ergonomic for tests that need `permissionMode: "forward"` or a very short timeout.

### 5. Implement ACP Tool Event Translation
- In `packages/nexus-acp-bridge/src/adapters/acp-protocol.ts`, add helpers to normalize ACP tool-call updates safely from unknown JSON:
  - extract `callID` from common fields such as `callId`, `callID`, `id`, or nested tool-call records;
  - extract human-readable `title` with a fallback such as `kind` or `"Tool call"`;
  - extract `kind`, `rawInput`, `rawOutput`, and error text without assuming a single ACP vendor shape;
  - map ACP statuses to `"pending" | "running" | "completed" | "failed"`.
- When handling `session/update` notifications in the active generation subscription, detect `sessionUpdate === "tool_call"` and publish a `tool.call` event.
- Detect `sessionUpdate === "tool_call_update"` and publish a `tool.call.updated` event.
- Ensure every emitted tool event includes the Nexus `sessionID` from `request.session.id` and the assistant `messageID` from `request.assistantMessageID`.
- Preserve existing text streaming for `agent_message_chunk` and `agent_thought_chunk`.
- Consumers that ignore unknown events should continue to work; do not change workflow-gen/prompt-gen behavior unless type errors require a safe default branch.

Pseudo-code shape:

```ts
if (update.sessionUpdate === "tool_call") {
  const event = toToolCallEvent(update, request.session.id, request.assistantMessageID);
  if (event) request.publishEvent?.(event);
  return;
}

if (update.sessionUpdate === "tool_call_update") {
  const event = toToolCallUpdatedEvent(update, request.session.id, request.assistantMessageID);
  if (event) request.publishEvent?.(event);
  return;
}
```

### 6. Implement Permission Forwarding in the ACP Adapter
- Add adapter maps for:
  - Nexus session ID → ACP session ID (existing map can remain);
  - ACP session ID → Nexus session ID;
  - ACP session ID → current permission mode;
  - pending permission request ID → resolver/timeout/session metadata.
- In `resolveAcpSession()`, populate both session maps when a new ACP session is created.
- In `generateText()`, record `request.permissionMode` for the ACP session before sending `session/prompt`.
- Keep current `handleRequestPermission()` auto-approval behavior when mode is `auto` or no Nexus session can be resolved.
- In `forward` mode:
  - allocate a stable `requestID` such as `permission_${crypto.randomUUID()}`;
  - normalize ACP options into `{ name, kind, optionId }[]`;
  - normalize tool call metadata into `{ title, kind? }`;
  - publish `permission.requested` through the active session event sink or an adapter-level event callback;
  - return a promise that resolves when `respondToPermission()` is called;
  - set a timeout using `config.permissionTimeoutMs`; on timeout, resolve `{ outcome: { outcome: "cancelled" } }` and remove pending state.
- Implement `respondToPermission()` to:
  - validate that the pending request exists and belongs to the supplied Nexus session;
  - clear the timeout;
  - resolve the pending JSON-RPC response as `{ outcome: { outcome: "selected", optionId } }` or `{ outcome: { outcome: "cancelled" } }`;
  - return `true` when resolved, `false` when missing/already resolved.
- On `dispose()`, clear all pending permission timeouts and resolve or reject safely so child JSON-RPC calls do not hang.

### 7. Wire Per-Session Permission Mode and Event Publishing in the Server
- In `packages/nexus-acp-bridge/src/server/http-server.ts`, extend `CreateSessionSchema` with optional `permissionMode: z.enum(["auto", "forward"])`.
- Store `permissionMode: payload.permissionMode ?? config.permissionMode` in `SessionRecord` when creating sessions.
- In `runPromptAsync()`, pass `assistantMessageId`, `record.permissionMode`, and an event publisher into `adapter.generateText()`:

```ts
publishEvent: (event) => this.eventBroker.publish(event, record.session.directory)
```

- Ensure text delta publishing remains exactly as it is today.
- Add `PermissionResponseSchema` for `POST /session/:id/permission` with:
  - `requestID: string`;
  - `outcome: "selected" | "cancelled"`;
  - `optionId?: string`.
- Add route `POST /session/:id/permission` before the generic `DELETE /session/:id` match.
- The route should:
  - require the session to exist;
  - validate that selected outcomes include an `optionId`;
  - call `adapter.respondToPermission` if implemented;
  - return `true` for resolved requests;
  - return a clear `404` or `400` error if no pending request exists or the adapter cannot handle forwarded permissions.
- Ensure CORS allows the new route through existing `POST` settings.

### 8. Mirror Browser OpenCode Types and Optional Service Helper
- In `src/lib/opencode/types.ts`, add the same `tool.call`, `tool.call.updated`, and `permission.requested` event variants to the `OpenCodeEvent` union.
- Add exported types for the permission requested event if useful for Phase B UI code.
- If needed, extend `SessionCreatePayload` to accept optional `permissionMode?: "auto" | "forward"`; keep this optional so existing OpenCode/direct server calls remain compatible.
- Optionally add a bridge-specific method in `src/lib/opencode/services/permissions.ts`:

```ts
async respondBridgeSession(
  sessionID: string,
  payload: { requestID: string; outcome: "selected" | "cancelled"; optionId?: string },
  opts?: RequestOptions,
): Promise<boolean> {
  return http.post<boolean>(`/session/${encodeURIComponent(sessionID)}/permission`, payload, opts);
}
```

- Do not create side-kick UI components in this task; Phase B will consume the events and endpoint.

### 9. Add Adapter Tests
- In `packages/nexus-acp-bridge/src/__tests__/acp-protocol-adapter.test.ts`, extend `FakeACPClient` if necessary so tests can emit tool-call updates while a generation is active.
- Add a test that emits ACP `tool_call` and `tool_call_update` notifications and asserts captured `publishEvent` calls include:
  - `type: "tool.call"` with exact `sessionID`, `messageID`, `callID`, `title`, and raw input;
  - `type: "tool.call.updated"` with exact `sessionID`, `messageID`, `callID`, status, and raw output/error.
- Add an auto-permission test confirming default mode still selects the first allow option exactly as before.
- Add a forward-permission test that:
  - invokes the registered `session/request_permission` handler with an ACP session already mapped to a Nexus session;
  - asserts a `permission.requested` event is emitted with exact `sessionID`, `requestID`, tool call title/kind, and options;
  - calls `adapter.respondToPermission({ sessionID, requestID, outcome: { outcome: "selected", optionId } })`;
  - asserts the handler resolves to `{ outcome: { outcome: "selected", optionId } }`.
- Add a forward-cancel test for `outcome: "cancelled"`.
- Add a timeout test using a very short `permissionTimeoutMs` and assert unresolved forwarded permissions return cancelled.

### 10. Add Server Tests
- In `packages/nexus-acp-bridge/src/__tests__/server.test.ts`, add a small test adapter or extend `MockACPAdapter` only if appropriate to emit custom events through `GenerateTextRequest.publishEvent`.
- Add a server integration test that subscribes to `/event`, starts a session/prompt, and confirms SSE includes the new tool event payload.
- Add a test for `POST /session` with `{ "permissionMode": "forward" }` and a prompt that triggers a forwarded permission request through the test adapter, if feasible.
- Add a direct route test for `POST /session/:id/permission` that verifies:
  - missing session returns 404;
  - selected outcome without `optionId` returns 400;
  - valid selected/cancelled payloads call the adapter and return `true`.
- Keep tests deterministic and avoid real ACP child processes.

### 11. Update Documentation and Environment Examples
- In `.env.example`, document:
  - `NEXUS_ACP_BRIDGE_PERMISSION_MODE=auto` or `forward`;
  - `NEXUS_ACP_BRIDGE_PERMISSION_TIMEOUT_MS=60000`.
- In `packages/nexus-acp-bridge/README.md`, update the reverse-handler section that currently says `session/request_permission` auto-approves.
- Document that `auto` is the default for compatibility, `forward` emits `permission.requested`, and callers reply through `POST /session/:id/permission`.
- Mention that per-session `permissionMode` can be supplied when creating a bridge session, if implemented.

### 12. Run Validation Commands
- Run all commands listed in the `Validation Commands` section.
- Fix any type, lint, test, or build failures.
- Re-run failed commands until all pass.

## Testing Strategy
### Unit Tests
- Bridge config tests for defaults, env parsing, and CLI parsing of permission mode/timeout.
- ACP adapter tests for tool-call event translation, auto permission selection, forwarded permission selected/cancelled responses, and forwarded permission timeout.
- HTTP server tests for new route validation and SSE delivery of new event types.
- Type-level/compile validation that browser `OpenCodeEvent` can represent bridge events.

### Edge Cases
- ACP tool-call update lacks a call ID: skip event or generate a deterministic fallback only if safe; tests should define expected behavior.
- ACP tool-call title/kind/input/output shapes differ by backend: normalize conservatively and preserve raw data fields.
- `tool_call_update` arrives before `tool_call`: still emit an update if `callID` is available so UI can reconcile later.
- No browser/SSE listener exists in `forward` mode: permission request should timeout and cancel instead of hanging forever.
- `respondToPermission()` receives an unknown, duplicate, or wrong-session `requestID`: return false/404 without resolving unrelated requests.
- Selected permission response omits `optionId`: reject with 400 before reaching adapter.
- Session abort or adapter dispose while permission is pending: clear timeout and resolve/cancel pending permission safely.
- Existing workflow/prompt generation ignores new event types and still receives text deltas normally.
- Default config remains `auto` so existing AI workflow generation does not require a permission UI.

## Acceptance Criteria
- `packages/nexus-acp-bridge/src/types.ts` and `src/lib/opencode/types.ts` include synchronized `tool.call`, `tool.call.updated`, and `permission.requested` SSE event variants.
- ACP `tool_call` and `tool_call_update` notifications are emitted as SSE events with exact Nexus `sessionID`, assistant `messageID`, `callID`, and normalized metadata.
- Bridge permission handling defaults to existing auto-approval behavior.
- A session can opt into `permissionMode: "forward"` and receive `permission.requested` events instead of auto-approval.
- `POST /session/:id/permission` resolves pending forwarded ACP permission requests for both selected and cancelled outcomes.
- Forwarded permission requests timeout to cancelled after the configured timeout.
- Existing workflow generation and prompt generation continue to process `message.part.delta` and ignore unrelated event types without crashes.
- Bridge tests cover tool events, auto permissions, forwarded permissions, timeout behavior, and the new HTTP route.
- Documentation/env examples describe the new permission mode and timeout settings.
- All validation commands pass.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

Use validation commands from `.app_config.yaml` where available, plus bridge-focused checks:

```bash
bun run test:bridge
bun run typecheck:bridge
npm run typecheck
npm run lint
npm run build
```

Notes:
- `.app_config.yaml` has no global test command configured, so `bun run test:bridge` is included for the touched package.
- Do not run browser/E2E commands here; this task adds bridge/API behavior and E2E is handled by a separate pipeline only when a UI-facing spec is created.

## Notes
- The task document recommends per-session permission mode after initially suggesting a global bridge mode. Implement both a config default and per-session override so workflow generation remains safe by default while the side-kick can opt in to forwarded permissions.
- Keep `src/lib/acp/*`, `src/store/acp/*`, WebSocket `/acp`, and separate ACP connect dialogs out of scope. The browser should continue to use the OpenCode-compatible client and bridge URL.
- Preserve `fs/read_text_file` and `fs/write_text_file` sandboxing exactly; this task changes permission flow, not filesystem trust boundaries.
- If ACP vendor payload shapes are uncertain, preserve original objects in `rawInput` / `rawOutput` and normalize only the fields the side-kick needs for stable rendering.

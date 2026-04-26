# feature: AI Side-Kick ACP UX

## Metadata
adw_id: `caa41bd1`
document_description: `Plan — Phase B: AI Side-Kick (UX on top of ACP via the bridge)`

## Description
The Task document calls for a persistent bottom-right AI side-kick for Nexus Workflow Studio. Unlike the existing one-shot `useWorkflowGenStore` prompt-to-workflow flow, this side-kick must support multi-turn chat, on-screen explanation, Nexus client-side workflow actions, inline approvals for destructive Nexus actions, forwarded ACP permission requests, streamed ACP tool-call rendering, and owner-only writes during collaboration.

The browser should keep using the existing OpenCode-shaped client/store (`src/lib/opencode/`, `src/store/opencode/`) against the bundled `nexus-acp-bridge`; it should not introduce a separate browser-side ACP client. ACP/native agent tools are represented by bridge SSE events such as `tool.call`, `tool.call.updated`, and `permission.requested`. Nexus app actions are not native ACP tools; they are parsed from assistant text as XML blocks of the form `<action name="..."><args>{...}</args></action>`, dispatched client-side, and fed back to the conversation as `<tool-result>` follow-up messages.

Complexity assessment: `complex` because this spans new Zustand state, streaming orchestration, parser logic, tool/action registry, OpenCode type/service updates, workflow store integration, collaboration safeguards, several UI components, keyboard/header integration, persistence, and automated tests.

## Objective
Implement a production-ready AI side-kick panel that can:

- Maintain one OpenCode/bridge session per conversation.
- Chat multi-turn with view context injection.
- Parse and execute Nexus client-side actions from assistant text.
- Gate destructive Nexus actions with inline approvals and ephemeral “Allow always”.
- Render forwarded ACP tool calls and ACP permission requests as inline cards.
- Mutate the current root workflow or active sub-workflow correctly.
- Respect collaboration ownership by refusing client-side writes for guests.
- Integrate cleanly with the existing editor shell, header, shortcuts, OpenCode client, and local persistence patterns.

## Problem Statement
Nexus currently has AI-powered generation flows, but they are one-shot and workflow-generation-specific. Users need an always-available assistant that understands the current editor state and can help incrementally: answer questions, inspect selected nodes, add/connect/edit nodes, save workflows, navigate sub-workflows, and coordinate with ACP-backed agent capabilities. The application also needs safe permission UX for destructive client-side actions and forwarded agent-side tool calls.

## Solution Statement
Add a dedicated side-kick feature module with three layers:

1. **Runtime/store layer** under `src/store/sidekick/`:
   - A Zustand store for panel state, messages, session lifecycle, pending approvals, allow-list, errors, and cancellation.
   - A runner that creates/reuses bridge sessions with `permissionMode: "forward"`, subscribes to SSE before sending prompts, routes events, parses assistant action blocks, dispatches Nexus tools, and sends follow-up `<tool-result>` messages.
   - A client-side Nexus action registry using `zod/v4` schemas and scope-aware handlers.
   - Context/system-prompt helpers for compact view snapshots and action catalog instructions.

2. **UI layer** under `src/components/workflow/sidekick/`:
   - Floating draggable/collapsible panel sharing existing workflow panel primitives.
   - Message list, input bar, Nexus action cards, ACP tool cards, and permission cards.

3. **Integration layer**:
   - Render the panel in `workflow-editor.tsx`.
   - Add `Mod+Alt+I` toggle and shortcuts-row documentation.
   - Add header toggle button.
   - Shrink the properties panel when both it and side-kick are open.
   - Extend OpenCode types/services for bridge session permission mode, ACP event variants, and session permission responses.

## Code Patterns to Follow
Reference implementations:

- `src/store/workflow-gen/workflow-generator.ts` — SSE subscription-before-send pattern, abort controller lifecycle, `message.part.delta` and `message.part.updated` handling, session creation, error-state handling.
- `src/store/workflow-gen/streaming-parser.ts` — tolerant incremental parsing approach that never throws on incomplete streams.
- `src/store/prompt-gen/runner.ts` — smaller prompt runner pattern for async OpenCode messages.
- `src/components/workflow/floating-workflow-gen.tsx` and `src/components/workflow/floating-workflow-gen/*` — floating AI panel composition and dark UI patterns.
- `src/components/workflow/floating-workflow-gen/use-floating-workflow-gen-position.ts` — draggable-position persistence pattern to adapt for bottom-right anchoring.
- `src/components/workflow/panel-primitives.ts` — canonical workflow panel shell/surface/button styling.
- `src/components/workflow/shared-header-actions.tsx` — header toggle button pattern for Library/Brain and external dialog event pattern.
- `src/components/workflow/workflow-editor.tsx` — global hotkey pattern using `isModKey`, custom events, and editable-target guards.
- `src/components/workflow/properties-panel.tsx` — panel sizing and right-side coexistence pattern.
- `src/lib/opencode/services/messages.ts`, `sessions.ts`, `permissions.ts`, `events.ts` — typed OpenCode-shaped service wrapper style.
- `src/lib/opencode/types.ts` — central API and SSE discriminated-union types.
- `src/store/opencode/connector-bus.ts` — connector invalidation pattern for session-bearing AI features.
- `src/store/workflow/store.ts` and `src/store/workflow/subworkflow.ts` — workflow/sub-workflow mutation APIs and nested sub-workflow persistence helpers.
- `src/lib/node-registry.ts` — source of truth for node-type catalog and default node data.
- `src/store/library/store.ts`, `src/store/knowledge/store.ts` — library and knowledge panel state/actions used by side-kick tools.
- `src/store/__tests__/workflow-gen/workflow-generator.test.ts` and `src/store/__tests__/prompt-gen/runner.test.ts` — store runner mocking patterns for OpenCode event streams.

## Relevant Files
Use these files to complete the task:

- `CLAUDE.md` — project coding rules: use Bun as package manager, `@/*` imports, Zod from `zod/v4`, dark-theme-first UI, client-heavy/localStorage assumptions, node-system guardrails, and validation expectations.
- `.app_config.yaml` — app configuration and validation commands; note it lists npm script invocations while the repository itself documents Bun.
- `README.md` — product behavior, supported AI/OpenCode/ACP bridge flows, keyboard shortcut table, and user-facing setup context.
- `docs/tasks/conditional_docs.md` — reviewed conditional documentation guide; no listed conditional document applies because this task does not modify Brain persistence or workspace routing/autosave APIs.
- `package.json` — script names and available test/typecheck/lint/build commands.
- `packages/nexus-acp-bridge/README.md` — bridge endpoint contract and currently documented OpenCode-shaped routes/events; use to verify browser-facing expectations.
- `src/lib/opencode/types.ts` — add or verify bridge-facing `permissionMode` session payload support and SSE variants for `tool.call`, `tool.call.updated`, and `permission.requested`.
- `src/lib/opencode/services/sessions.ts` — ensure `client.sessions.create({ title, permissionMode })` forwards the field.
- `src/lib/opencode/services/permissions.ts` — add a `/session/:id/permission` responder while preserving existing OpenCode permission APIs.
- `src/lib/opencode/services/index.ts` — verify any new/changed permission service export remains included.
- `src/lib/opencode/client.ts` — use existing request/stream/abort semantics; no new HTTP client should be created.
- `src/store/opencode/store.ts` — source of connected OpenCode client/status and selected model/provider state.
- `src/store/opencode/connector-bus.ts` — subscribe to connector changes and invalidate side-kick sessions.
- `src/store/workflow/store.ts` — workflow action surface for add/update/delete/select/connect/open sub-workflow/save-state operations.
- `src/store/workflow/subworkflow.ts` — nested sub-workflow update helpers for scope-aware tools.
- `src/store/workflow/helpers.ts` — workflow JSON building/fingerprint helpers used by save/mark-saved tools.
- `src/store/library/store.ts` — save/list workflow library actions used by side-kick tools.
- `src/store/knowledge/store.ts` and `src/store/knowledge-store.ts` — knowledge document panel/listing state used by side-kick tools.
- `src/store/collaboration` files — collaboration owner/guest state for owner-only write guards.
- `src/types/workflow.ts` — canonical workflow, node, edge, and node-type types for tool schemas/handlers.
- `src/lib/node-registry.ts` — node catalog for `listNodeTypes`, node creation defaults, and system prompt documentation.
- `src/lib/workflow-connections.ts` — connection normalization logic for `connectNodes`.
- `src/lib/auto-layout.ts` or existing auto-layout helper location — reuse for `autoLayout` instead of duplicating layout logic.
- `src/components/workflow/workflow-editor.tsx` — render `<SidekickPanel />`, wire `Mod+Alt+I`, and dispatch `nexus:toggle-sidekick`.
- `src/components/workflow/properties-panel.tsx` — adjust height when side-kick and properties panel are both open.
- `src/components/workflow/header/use-header-controller.ts` — expose `isSidekickOpen` and `toggleSidekick`.
- `src/components/workflow/header.tsx` — pass side-kick state/actions into header controls as needed.
- `src/components/workflow/header/workflow-actions.tsx` — add the compact side-kick toggle button or consume a shared toggle button.
- `src/components/workflow/shared-header-actions.tsx` — follow Library/Brain toggle patterns; add a `SidekickToggleButton` if shared placement is preferred.
- `src/components/workflow/shortcuts-dialog.tsx` — document `Mod+Alt+I`.
- `src/components/workflow/panel-primitives.ts` — reuse existing panel classes.
- `src/components/workflow/floating-workflow-gen/use-floating-workflow-gen-position.ts` — adapt draggable positioning for side-kick.

### New Files
- `src/store/sidekick/types.ts` — side-kick message/status/tool/permission/approval types.
- `src/store/sidekick/store.ts` — Zustand store for side-kick state and public actions.
- `src/store/sidekick/runner.ts` — OpenCode session/message/event orchestration and action loop.
- `src/store/sidekick/streaming-action-parser.ts` — incremental parser for `<action>` blocks, skipping fenced code.
- `src/store/sidekick/tools.ts` — Nexus client-side action registry and dispatch helper.
- `src/store/sidekick/context.ts` — compact view snapshot and `<tool-result>` message builders.
- `src/store/sidekick/system-prompt.ts` — side-kick system prompt and tool catalog instructions.
- `src/store/sidekick/index.ts` — barrel exports for side-kick store/types/helpers.
- `src/components/workflow/sidekick/panel.tsx` — floating panel shell.
- `src/components/workflow/sidekick/messages.tsx` — message list and role renderers.
- `src/components/workflow/sidekick/action-card.tsx` — Nexus action status/approval card.
- `src/components/workflow/sidekick/acp-tool-card.tsx` — ACP tool call/update card.
- `src/components/workflow/sidekick/permission-card.tsx` — forwarded ACP permission card.
- `src/components/workflow/sidekick/input-bar.tsx` — textarea, send/cancel controls, `Cmd/Ctrl+Enter` submit.
- `src/components/workflow/sidekick/use-sidekick-position.ts` — draggable bottom-right positioning hook.
- `src/store/sidekick/__tests__/streaming-action-parser.spec.ts` — parser unit tests.
- `src/store/sidekick/__tests__/tools.spec.ts` — tool registry/handler unit tests.
- `src/store/sidekick/__tests__/runner.integration.spec.ts` — mocked event-stream runner integration tests.
- `src/store/sidekick/__tests__/context.spec.ts` — view-snapshot and tool-result golden tests.
- `docs/tasks/ai-sidekick-acp-ux-caa41bd1/e2e-ai-sidekick-acp-ux-caa41bd1.md` — E2E specification to create during implementation. Do not execute it in implementation validation; the separate E2E pipeline will run it.

## Implementation Plan
### Phase 1: Foundation
- Verify the Phase A bridge/API contract in the checked-out branch. If `src/lib/opencode/types.ts` and `packages/nexus-acp-bridge` do not yet expose `permissionMode`, `tool.call`, `tool.call.updated`, `permission.requested`, and `/session/:id/permission`, update browser-facing OpenCode types/services and coordinate with/merge Phase A before implementing side-kick behavior that depends on them.
- Define side-kick domain types, persistence keys, status state machine, and message model.
- Build the incremental action parser with robust partial-buffer and fenced-code handling.
- Build context and system-prompt helpers with a compact snapshot and action catalog.
- Build the `zod/v4` client-side tool registry with read-only, safe write, and destructive groups.

### Phase 2: Core Implementation
- Implement store and runner orchestration:
  - Ensure one session per conversation.
  - Persist `sessionId` and panel position to localStorage.
  - Restore history with `client.messages.list(sessionId)` on mount/init.
  - Create sessions using `permissionMode: "forward"`.
  - Subscribe to SSE before sending each prompt.
  - Process text deltas/updates, ACP tool events, permission events, session idle, and session errors.
  - Dispatch parsed Nexus action calls after idle.
  - Pause for destructive approvals and resume/deny/skip correctly.
  - Send `<tool-result>` follow-up turns until no actions run.
- Implement scope-aware tool handlers for root vs active sub-workflow contexts.
- Enforce collaboration write guards for all write/destructive tools.
- Add unit/integration coverage for parser, context, tools, and runner.

### Phase 3: Integration
- Implement the floating side-kick panel and cards using existing workflow styling primitives.
- Add header button and `Mod+Alt+I` toggle event.
- Add shortcuts dialog row.
- Shrink properties panel height when side-kick is open.
- Subscribe to connector-bus invalidation and clear side-kick session/history appropriately.
- Create the task E2E spec file with browser steps and screenshot checkpoints, without running E2E during implementation.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Confirm Bridge/OpenCode API Contract
- Inspect `src/lib/opencode/types.ts`, `src/lib/opencode/services/sessions.ts`, `src/lib/opencode/services/permissions.ts`, and `packages/nexus-acp-bridge/src/server/http-server.ts`.
- If the branch does not already contain Phase A additions, update the browser-facing TypeScript types and services at minimum:
  - Extend `SessionCreatePayload` with `permissionMode?: "auto" | "forward"`.
  - Add event variants for `tool.call`, `tool.call.updated`, and `permission.requested` with property shapes matching the bridge.
  - Add a permission response method that posts to `/session/${sessionId}/permission` with `{ requestId, outcome, optionId? }` or the exact Phase A payload shape.
- Preserve the existing `permission.asked` / `permission.replied` APIs for direct OpenCode compatibility.
- If server bridge support is missing in this branch, stop and reconcile with Phase A before relying on forwarded permissions in the side-kick runner.

### 2. Define Side-Kick Types and Store Skeleton
- Create `src/store/sidekick/types.ts` with discriminated types for:
  - `SidekickRole = "user" | "assistant" | "tool" | "acp-tool" | "permission"`.
  - `SidekickMessage` variants for text, Nexus action cards, ACP tool cards, and permission cards.
  - `SidekickStatus` values such as `idle`, `creating-session`, `streaming`, `running-tools`, `awaiting-approval`, `awaiting-permission`, `error`.
  - `ToolCall`, `ToolResult`, `PendingApproval`, `AllowList`, and ACP permission request/option types.
- Create `src/store/sidekick/store.ts` with state for `messages`, `status`, `sessionId`, `panelOpen`, `panelCollapsed`, `panelPosition`, `pendingApproval`, `allowList`, `error`, and `_abortController`.
- Implement public actions: `send`, `cancel`, `newConversation`, `togglePanel`, `setPanelOpen`, `setPanelCollapsed`, `setPanelPosition`, `approve`, `deny`, and `respondToAcpPermission`.
- Persist only `sessionId` and `panelPosition` to localStorage. Keep `Allow always` ephemeral in memory so it resets on reload.
- Add `src/store/sidekick/index.ts` exports.

### 3. Implement View Context and System Prompt Helpers
- Create `src/store/sidekick/context.ts`.
- Implement `buildViewSnapshot()` using current stores and keep it compact, e.g.:
  ```xml
  <view-snapshot>
  workflow.name=...
  workflow.dirty=true
  workflow.activeId=...
  workflow.nodes.count=...
  workflow.edges.count=...
  workflow.selectedNodeId=...
  view.subWorkflowDepth=...
  view.activeSubWorkflowParentLabel=...
  view.propertiesPanelOpen=...
  view.libraryOpen=...
  view.knowledgePanelOpen=...
  view.canvasMode=...
  collab.inRoom=...
  collab.isOwner=...
  </view-snapshot>
  ```
- Implement `buildToolResultMessage(results)` that emits deterministic `<tool-result>` blocks with action ids, names, `ok`, serialized result payloads, and error codes/messages.
- Create `src/store/sidekick/system-prompt.ts`.
- Use `NODE_REGISTRY` to list node types with one-line summaries.
- Explain the two tool surfaces: ACP agent tools are native/bridge-rendered; Nexus actions must be emitted as XML action blocks.
- Document conditional handles (`IfElse` / `Switch` use `branch-${index}`) and automatic sub-workflow scope routing.

### 4. Implement Streaming Action Parser
- Create `src/store/sidekick/streaming-action-parser.ts`.
- Implement an incremental parser that accepts text chunks and emits completed calls only when `</action>` is seen.
- Track code-fence state so `<action>` examples inside fenced Markdown are ignored.
- Support partial `<action>`, `name="..."`, `<args>`, JSON body, `</args>`, and `</action>` split across chunks.
- Return structured parse errors instead of throwing when JSON is malformed.
- Add tests in `src/store/sidekick/__tests__/streaming-action-parser.spec.ts` for:
  - single complete action in one chunk,
  - action split across many chunks,
  - multiple actions in one stream,
  - fenced-code action ignored,
  - malformed args surfaced as an invalid-args call/result,
  - ordinary assistant prose preserved for display.

### 5. Implement Nexus Client-Side Tool Registry
- Create `src/store/sidekick/tools.ts`.
- Import Zod from `zod/v4`.
- Define `ToolDefinition` with `name`, `description`, `schema`, `destructive`, optional `write`, and `handler`.
- Implement `getToolCatalog()` for the system prompt.
- Implement `dispatchTool(call)` that validates args, checks unknown tools, enforces collaboration write guards, catches handler errors, and returns a `ToolResult`.
- Implement read-only tools:
  - `getCurrentWorkflow`, `getNode`, `listNodes`, `listEdges`, `listNodeTypes`, `getViewState`, `listSavedWorkflows`, `listKnowledgeDocs`.
- Implement safe write tools:
  - `addNode`, `updateNodeData`, `connectNodes`, `selectNode`, `selectAll`, `duplicateNode`, `setName`, `openPropertiesPanel`, `closePropertiesPanel`, `openSubWorkflow`, `closeSubWorkflow`, `navigateToBreadcrumb`, `groupIntoSubWorkflow`, `setCanvasMode`, `fitView`, `autoLayout`, `saveWorkflow`, `markWorkflowSaved`, `openLibrary`, `closeLibrary`, `openKnowledgePanel`, `closeKnowledgePanel`.
- Implement destructive tools:
  - `deleteNode`, `deleteEdge`.
- For scope-aware mutation:
  - Read `activeSubWorkflowNodeId` from `useWorkflowStore.getState()`.
  - If not in a sub-workflow, use root `nodes`/`edges` actions.
  - If in a sub-workflow, update `subWorkflowNodes`/`subWorkflowEdges` and persist changes into the parent sub-workflow data via existing store helpers/actions.
- For `addNode`, default missing `position` to viewport center plus deterministic jitter. Return the created node id; if the existing `addNode` action does not return the node, compute the id by comparing nodes before/after or add a minimal store helper if necessary.
- For `connectNodes`, reuse `normalizeWorkflowConnection`; default `sourceHandle` to `"output"` only for non-conditional nodes.
- For `deleteNode`, return `node_not_deletable` when the target is protected or missing rather than pretending success.
- Add tests in `src/store/sidekick/__tests__/tools.spec.ts` for all tool groups and critical error codes.

### 6. Implement Runner Orchestration
- Create `src/store/sidekick/runner.ts`.
- Adapt the event-subscribe-before-send pattern from `src/store/workflow-gen/workflow-generator.ts`.
- Implement `ensureSidekickSession()`:
  - Reuse `sessionId` when available.
  - Create `client.sessions.create({ title: "Nexus Side-kick", permissionMode: "forward" })` when absent.
  - Store the returned id.
- Implement history restoration on panel mount/init using `client.messages.list(sessionId)` and map bridge/OpenCode messages to `SidekickMessage` text messages.
- Implement `sendSidekickTurn(text)`:
  - Add the user message locally.
  - Build system prompt and prepend `buildViewSnapshot()` to the user payload.
  - Subscribe to `client.events.subscribe({ signal })` and prime the iterator before `client.messages.sendAsync(...)`.
  - Track assistant text by part id for both `message.part.delta` and `message.part.updated`.
  - Update or append assistant message text as deltas arrive.
  - Feed text deltas into `streaming-action-parser`.
  - Render `tool.call` as pending ACP tool cards and `tool.call.updated` as updated cards.
  - Render `permission.requested` as permission cards and allow `respondToAcpPermission` to POST the selected response.
  - On `session.idle`, stop streaming for that turn and dispatch parsed actions in order.
  - If actions ran, send a follow-up user message with `<tool-result>` blocks and repeat until the assistant emits no new actions.
  - If `session.error` or fetch/stream errors occur, set `status: "error"`, preserve visible messages, and clear abort state.
- Implement cancellation via abort controller and `client.sessions.abort(sessionId)` when possible.
- Add `newConversation()` to delete the old session, clear history/allow-list, create a fresh forward-permission session on next send, and reset errors.
- Subscribe to `connector-bus` so connector/agent/preset changes clear session state and inform the user in the message thread or error banner.
- Add `src/store/sidekick/__tests__/runner.integration.spec.ts` with scripted async generators for event sequences covering text-only response, Nexus actions + follow-up, ACP tool call updates, permission response, session error, and cancellation.

### 7. Build Floating Side-Kick UI Components
- Create `src/components/workflow/sidekick/use-sidekick-position.ts` by adapting the floating workflow-gen position hook for a bottom-right anchored panel.
- Create `src/components/workflow/sidekick/panel.tsx` as a client component.
- Reuse `WORKFLOW_PANEL_SHELL_BASE_CLASS`, `WORKFLOW_PANEL_SURFACE_CLASS`, and other primitives from `panel-primitives.ts`.
- Support:
  - bottom-right default placement,
  - drag handle,
  - collapse to pill,
  - reopen/toggle,
  - “New conversation”,
  - status/error banner,
  - coexisting z-index with properties/library/brain panels.
- Create `messages.tsx` with renderers for user, assistant, tool/action, ACP tool, and permission messages.
- Use a lightweight Markdown/prose rendering approach consistent with existing dependencies; avoid adding new dependencies unless necessary.
- Create `input-bar.tsx` with auto-grow textarea, Send, Cancel, disabled states, and `Cmd/Ctrl+Enter` submit.
- Ensure all interactive controls have accessible labels and visible focus styles.

### 8. Build Action, ACP Tool, and Permission Cards
- Create `action-card.tsx`.
- Render status states: `pending`, `awaiting-approval`, `running`, `done`, `error`, `denied`, `skipped`.
- For destructive tools in `awaiting-approval`, show exact buttons:
  - `Allow once`,
  - `Allow always`,
  - `Deny`.
- Make `Allow always` apply only to the in-memory session allow-list and reset on reload/new conversation.
- Create `acp-tool-card.tsx`.
- Render ACP tool title/name, status, and collapsible raw input/output sections.
- Create `permission-card.tsx`.
- Render the bridge/ACP permission request and each option as a button.
- On click, call `useSidekickStore.getState().respondToAcpPermission(requestId, outcome, optionId)` and update the card state.
- Handle expired/cancelled permission states gracefully.

### 9. Integrate Panel, Header, Hotkey, and Properties Coexistence
- In `src/components/workflow/workflow-editor.tsx`:
  - Import and render `<SidekickPanel />` next to `<FloatingWorkflowGen />`.
  - Add global `Mod+Alt+I` hotkey with the existing editable-target guard.
  - Dispatch or handle `nexus:toggle-sidekick` consistently with other panel events.
- In `src/components/workflow/header/use-header-controller.ts`:
  - Add `isSidekickOpen` and `toggleSidekick` to the controller surface.
  - Listen for `nexus:toggle-sidekick` or implement direct store toggling, following the workflow-gen pattern.
- In `src/components/workflow/shared-header-actions.tsx` or `header/workflow-actions.tsx`:
  - Add a side-kick toggle button with a sparkle/wand/message icon.
  - Set `aria-pressed`, `aria-label`, active styling, and tooltip.
- In `src/components/workflow/header.tsx`:
  - Wire side-kick state/action props to the chosen header button location.
- In `src/components/workflow/shortcuts-dialog.tsx`:
  - Add a `Mod+Alt+I` row labeled `AI side-kick` or `Toggle AI side-kick`.
- In `src/components/workflow/properties-panel.tsx`:
  - Subscribe to `useSidekickStore((s) => s.panelOpen)`.
  - When side-kick and properties are open, shrink properties height, e.g. root canvas: `calc(50vh - 24px)`, while preserving existing sub-workflow height behavior.

### 10. Create E2E Specification File
- Create `docs/tasks/ai-sidekick-acp-ux-caa41bd1/e2e-ai-sidekick-acp-ux-caa41bd1.md` during implementation.
- Do not execute E2E tests as part of implementation validation.
- Structure the E2E spec with these sections:
  - `User Story` — validating that a workflow author can use the AI side-kick to inspect, modify, approve destructive actions, and respond to forwarded ACP permissions.
  - `Test Steps` — browser interactions using `playwright-cli` only in the E2E pipeline. Include minimal flows:
    1. Open the side-kick via header button and capture screenshot `sidekick-open-empty`.
    2. Send `What can you tell me about this canvas?` and assert an assistant text response with no action card.
    3. Send `Add a Prompt node named Draft Prompt and connect it after Start` using a mocked/deterministic bridge response, then assert an `addNode` card is `done`, a `connectNodes` card is `done`, and the canvas contains `Draft Prompt`; capture `sidekick-action-success`.
    4. Select the created node and send `Delete this node`, assert a destructive action card appears with `Allow once`, `Allow always`, `Deny`; capture `sidekick-approval-card`.
    5. Click `Deny`, assert the node remains and the card status is `denied`.
    6. Repeat delete, click `Allow once`, assert the node is removed and status is `done`.
    7. Trigger a mocked forwarded ACP permission request, assert the permission card displays option buttons, choose `allow_once`, and assert it becomes resolved; capture `sidekick-permission-resolved`.
    8. Click `New conversation`, assert message history clears and side-kick remains open; capture `sidekick-new-conversation`.
  - `Success Criteria` — exact UI states/cards/statuses expected.
  - `Screenshot Capture Points` — list all named screenshots above.
- Keep browser-driving steps only in this E2E file, not in implementation task execution.

### 11. Add Automated Tests
- Add `src/store/sidekick/__tests__/context.spec.ts` for `buildViewSnapshot()` and `buildToolResultMessage()` golden output.
- Add parser, tool, and runner tests from earlier steps if not already completed.
- Mock stores with `useWorkflowStore.setState`, `useSavedWorkflowsStore.setState`, and `useOpenCodeStore.setState` using existing test patterns.
- Include edge cases:
  - malformed args,
  - unknown tool name,
  - action inside fenced code,
  - bridge unreachable / no client,
  - collab guest write refused with `collab_guest_readonly`,
  - protected Start node deletion returns `node_not_deletable`,
  - denied destructive action skips remaining destructive batch as `skipped_after_deny`,
  - active sub-workflow mutations update sub-workflow state rather than root nodes.

### 12. Update User-Facing Shortcut Documentation if Needed
- If README shortcut docs are maintained for every app shortcut, add `Ctrl/Cmd + Alt + I | Toggle AI side-kick` to `README.md`.
- Keep the description short and durable.

### 13. Run Validation Commands
- Run every command listed in the `Validation Commands` section.
- Fix all TypeScript, lint, test, and build failures.
- Do not run browser/E2E tests here; the E2E pipeline consumes the E2E spec separately.

## Testing Strategy
### Unit Tests
- Parser tests for incremental XML extraction, code-fence skipping, multiple actions, malformed args, and partial chunks.
- Context tests for compact view snapshots covering empty canvas, selected node, library/knowledge panel state, collab guest/owner, and active sub-workflow depth.
- Tool tests for every MVP tool category with seeded workflow/library/knowledge/collab stores.
- Runner integration tests with a mocked OpenCode client and scripted SSE generator covering:
  - text-only assistant response,
  - action parse + dispatch + tool-result follow-up,
  - destructive approval pause/resume/deny,
  - ACP tool cards,
  - forwarded permission response POST,
  - session idle loop termination,
  - session error and abort cleanup,
  - connector invalidation.

### Edge Cases
- No OpenCode/bridge client connected: side-kick shows a recoverable error and does not mutate canvas.
- Bridge unreachable on first send: status becomes error; existing editor remains usable.
- Existing persisted `sessionId` no longer exists: history restore failure clears session id and creates a new session on next send.
- Malformed `<args>` JSON: action card errors and a `<tool-result>` error is fed back.
- Unknown tool name: returns `unknown_tool` and allows the model to self-correct.
- Assistant emits `<action>` syntax in a Markdown code fence: parser ignores it.
- Multiple destructive actions: first approval can allow once/always/deny; deny skips the rest deterministically.
- `deleteNode` against Start or missing node: returns explicit error without modifying workflow.
- Active sub-workflow: all node/edge writes route to the sub-workflow data and do not leak to root.
- Collaboration guest writes: all write/destructive tools return `collab_guest_readonly` while read-only chat continues.
- Permission request expires/cancels: card shows expired/cancelled and assistant can continue.
- User closes/collapses panel during streaming or pending permission: state remains consistent and visible when reopened.
- Connector/preset switch mid-conversation: old session is invalidated and next send uses a fresh session.
- Reload after “Allow always”: destructive actions ask again because allow-list is ephemeral.

## Acceptance Criteria
- A bottom-right side-kick panel can be opened from the header and with `Mod+Alt+I`.
- The panel is draggable, collapsible, dark-theme consistent, and coexists with the properties panel by reducing properties height when both are open.
- Side-kick conversations use one persisted OpenCode/bridge session per conversation and restore message history when possible.
- New side-kick sessions are created with `permissionMode: "forward"`; existing workflow-gen and prompt-gen sessions retain their current default behavior.
- User turns include a compact view snapshot, not full workflow JSON by default.
- Assistant text streams into the panel incrementally.
- Nexus `<action>` blocks are parsed from streamed assistant text, excluding fenced-code examples.
- MVP read-only, safe-write, and destructive Nexus tools are implemented with schema validation and typed result/error payloads.
- Destructive Nexus actions render inline approval cards with `Allow once`, `Allow always`, and `Deny`.
- `Allow always` is ephemeral and resets on reload/new conversation.
- ACP `tool.call` and `tool.call.updated` events render as collapsible cards.
- ACP `permission.requested` events render as inline permission cards and user responses POST back to the bridge.
- Client-side write tools are refused for non-owner users in collaborative standalone sessions.
- Root/sub-workflow scope routing works for node and edge mutations.
- Connector/preset changes invalidate side-kick sessions.
- The E2E spec file is created at `docs/tasks/ai-sidekick-acp-ux-caa41bd1/e2e-ai-sidekick-acp-ux-caa41bd1.md` with user story, test steps, success criteria, and screenshot checkpoints.
- All validation commands pass without errors.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

Use validation commands from `.app_config.yaml` if available:

```bash
npm run typecheck
npm run lint
npm run build
bun test src/store/sidekick src/store/__tests__/workflow-gen src/store/__tests__/prompt-gen src/lib/__tests__
```

No browser commands, Playwright commands, `playwright-cli` commands, or HTTP probes against a running app belong here; those are reserved for the separate E2E pipeline.

## Notes
- The Task document assumes Phase A bridge work exists. The current tree should be checked before implementation; if the bridge route/event contract is absent, merge or implement Phase A compatibility first.
- Keep browser persistence minimal: session id and panel position are durable; approval allow-list is intentionally not durable.
- Do not introduce a browser ACP client. The side-kick uses `OpenCodeClient` exactly like existing AI features.
- Prefer extending existing store/actions over duplicating workflow mutation logic.
- Use `@/*` path aliases for app imports and `zod/v4` for schemas.
- Treat generated UI primitives in `src/components/ui/` as read-only; compose existing primitives instead.

# Nexus ACP Bridge

`nexus-acp-bridge` is a small Bun HTTP/SSE server that exposes the subset of the OpenCode-style API Nexus currently uses, so Nexus can connect to a bridge URL while the bridge talks to an ACP-compatible backend.

## What it provides

- `GET /global/health`
- `GET /command`
- `GET /config/providers`
- `GET /project`
- `GET /project/current`
- `GET /experimental/tool`
- `GET /experimental/tool/ids`
- `GET /mcp`
- `GET /experimental/resource`
- `GET /file`
- `GET /file/content`
- `GET /file/status`
- `GET /session`
- `POST /session`
- `GET /session/:id/message`
- `POST /session/:id/command`
- `POST /session/:id/message`
- `POST /session/:id/prompt_async`
- `POST /session/:id/abort`
- `DELETE /session/:id`
- `GET /event` (SSE)

The bridge now supports three adapter modes:

- `mock` — deterministic local responses for Nexus development
- `stdio` — launches a configured agent command and streams its stdout back through the bridge
- `acp` — keeps a persistent stdio connection open and speaks configurable JSON-RPC to a real ACP runtime

## Run

From the repo root:

```bash
bun run nexus-acp-bridge
```

This starts the bridge with the bundled defaults (which select the `claude-code` preset and the `acp` adapter).

### CLI flags (recommended)

```bash
# Pick an agent and customise the bridge with one command:
bun run nexus-acp-bridge --agent claude --cors http://localhost:3000

# Other supported flags:
bun run nexus-acp-bridge \
  --agent claude \              # claude | claude-code | codex | opencode (alias of --tool)
  --cors http://localhost:3000 \
  --port 4080 \
  --host 127.0.0.1 \
  --project-dir /path/to/repo \ # may be passed multiple times
  --no-auto-setup               # opt out of auto-vendoring claude-agent-acp
```

CLI flags take precedence over both `.env.defaults` and the selected tool preset, but explicit shell environment variables still win.

### Auto setup for `--agent claude`

When you use `--agent claude` (or any path that resolves to the `claude-code` preset) and the vendored binary is missing, the bridge will automatically run the equivalent of `bun run nexus-acp-bridge:setup-claude` to install `@agentclientprotocol/claude-agent-acp@0.31.0` into `packages/nexus-acp-bridge/vendor/claude-code/` before starting.

To opt out, pass `--no-auto-setup` or set `NEXUS_ACP_BRIDGE_AUTO_SETUP_CLAUDE=0`. You can still trigger the install manually:

```bash
bun run nexus-acp-bridge:setup-claude            # install if missing
bun run nexus-acp-bridge:setup-claude -- --force # force reinstall
```

### Preset shortcuts

```bash
bun run nexus-acp-bridge:claude
bun run nexus-acp-bridge:codex
bun run nexus-acp-bridge:opencode
```

These are equivalent to `bun run nexus-acp-bridge --agent <id>`.

### Environment-style usage (still supported)

```bash
NEXUS_ACP_BRIDGE_CORS_ORIGIN="http://localhost:3000" bun run nexus-acp-bridge:claude
NEXUS_ACP_BRIDGE_TOOL=opencode bun run nexus-acp-bridge
```

If the configured bridge port is already occupied, the bridge automatically retries on a random available port and logs the resolved port at startup.

Then point Nexus to the bridge URL, usually:

```text
http://127.0.0.1:4080
```

## Environment

Use the example files in `examples/` as starting points.

Bundled tool presets currently include:

- `claude-code` → `npx --yes @agentclientprotocol/claude-agent-acp@0.31.0`
- `codex` → `npx --yes @zed-industries/codex-acp`
- `opencode` → `opencode acp`

You can select one with `--tool <id>` or `NEXUS_ACP_BRIDGE_TOOL=<id>`, and then override any individual setting with the standard bridge environment variables.

## Adapter shape

The mock adapter lives in `src/adapters/mock.ts`, the one-shot process-backed adapter lives in `src/adapters/stdio.ts`, and the persistent JSON-RPC ACP adapter lives in `src/adapters/acp-protocol.ts`. All implement the `ACPAdapter` interface from `src/types.ts`. Adapter selection is centralized in `src/index.ts`'s `createAdapter()`.

To integrate a real ACP backend later, replace or extend the adapter selection in `src/index.ts` with an adapter that:

1. discovers models/providers
2. discovers tools/MCP-backed capabilities
3. opens a session or conversation handle
4. streams text deltas back to the bridge
5. maps backend failures to `session.error`

## `stdio` mode contract

When `NEXUS_ACP_BRIDGE_ADAPTER=stdio`, the bridge launches `NEXUS_ACP_BRIDGE_AGENT_COMMAND` with `NEXUS_ACP_BRIDGE_AGENT_ARGS`, writes a JSON request envelope to the child process stdin, and forwards stdout chunks as streamed text deltas.

Current request envelope shape:

```json
{
  "session": { "id": "..." },
  "project": { "worktree": "/path/to/project" },
  "payload": {
	"parts": [{ "type": "text", "text": "..." }],
	"system": "...",
	"model": { "providerID": "...", "modelID": "..." }
  }
}
```

This is intentionally lightweight: it is a practical process adapter for now, not a formal ACP protocol implementation yet.

## `acp` mode contract

When `NEXUS_ACP_BRIDGE_ADAPTER=acp`, the bridge:

1. starts a persistent child process using `NEXUS_ACP_BRIDGE_AGENT_COMMAND`
2. speaks the real [Agent Client Protocol](https://agentclientprotocol.com) over stdio (JSON-RPC 2.0, newline-framed by default, `Content-Length`-framed on request)
3. negotiates via `initialize` with `protocolVersion: 1` and advertises `fs.readTextFile` + `fs.writeTextFile` client capabilities
4. creates an ACP session per bridge session via `session/new`, keyed by the bridge session id
5. streams agent output from `session/update` notifications with the `agent_message_chunk` and `agent_thought_chunk` variants (text content blocks)
6. forwards `tool_call` / `tool_call_update` notifications as OpenCode-compatible `tool.call` / `tool.call.updated` SSE events with the bridge `sessionID`, assistant `messageID`, and ACP call id
7. caches slash-command advertisements from `session/update` notifications with the `available_commands_update` variant and exposes them via `GET /command`
8. sends `session/cancel` when Nexus aborts a prompt

The bridge responds to agent-initiated requests:

- `fs/read_text_file` — reads files inside configured project roots, honoring optional `line` / `limit` parameters
- `fs/write_text_file` — writes files inside configured project roots
- `session/request_permission` — defaults to `auto`, which preserves compatibility by selecting the first `allow_once` / `allow_always` option (or the first option if none are explicitly "allow"). Set `NEXUS_ACP_BRIDGE_PERMISSION_MODE=forward` or create a session with `{ "permissionMode": "forward" }` to emit `permission.requested` SSE events instead. Callers resolve forwarded requests with `POST /session/:id/permission` and a body such as `{ "requestID": "permission_...", "outcome": "selected", "optionId": "allow_once" }` or `{ "requestID": "permission_...", "outcome": "cancelled" }`. Unanswered forwarded requests cancel after `NEXUS_ACP_BRIDGE_PERMISSION_TIMEOUT_MS` (default `60000`).

Tools, MCP status, provider metadata, and resources are served locally from the bridge's configured defaults — ACP does not expose discovery endpoints for these.
Slash commands are the exception: ACP advertises them dynamically through `session/update`, and the bridge normalizes those into an OpenCode-style `GET /command` response. `POST /session/:id/command` is translated into a slash-command prompt like `/plan add tests` before it is forwarded to ACP.

## Current behavior

The mock adapter is intentionally deterministic so Nexus can exercise its flows:

- workflow generation returns a minimal valid workflow JSON object
- example generation returns a JSON string array
- prompt generation/editing returns Markdown/plain text

That makes it useful for local development even before a real ACP transport is plugged in.

The `stdio` adapter is useful when you already have a local command-based agent runtime and want Nexus to talk to it through this bridge without changing the frontend.

The `acp` adapter is what you should use once you have a real ACP runtime that supports persistent JSON-RPC messaging.



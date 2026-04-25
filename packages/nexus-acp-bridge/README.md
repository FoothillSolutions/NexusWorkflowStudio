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
bun run bridge:acp
```

By default, the bridge auto-loads bundled defaults from `packages/nexus-acp-bridge/.env.defaults`. Those defaults currently select the `claude-code` tool preset.

### One-time setup for the `claude-code` preset

The Claude preset now uses [`@agentclientprotocol/claude-agent-acp`](https://www.npmjs.com/package/@agentclientprotocol/claude-agent-acp). Vendor a local copy once so the bridge can launch a pinned binary from the repo:

```bash
bun run bridge:setup-claude
```

This creates `packages/nexus-acp-bridge/vendor/claude-code/` with `@agentclientprotocol/claude-agent-acp@0.31.0`. The `claude-code` preset automatically picks up this vendored binary when it exists and falls back to `npx --yes @agentclientprotocol/claude-agent-acp@0.31.0` (with a warning) when it does not.

Re-run with `--force` to reinstall:

```bash
bun run bridge:setup-claude -- --force
```

### Start a preset directly

```bash
bun run bridge:acp:claude
bun run bridge:acp:codex
bun run bridge:acp:opencode
```

Or choose a preset dynamically:

```bash
bun run bridge:acp --tool codex
NEXUS_ACP_BRIDGE_TOOL=opencode bun run bridge:acp
```

Explicit shell environment variables still override both bundled defaults and preset values.

If the configured bridge port is already occupied, the bridge now automatically retries on a random available port and logs the resolved port at startup.

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

Important variables:

- `NEXUS_ACP_BRIDGE_TOOL` (`claude-code`, `codex`, `opencode`, or unset for custom env-only config)
- `NEXUS_ACP_BRIDGE_ADAPTER` (`mock`, `stdio`, or `acp`)
- `NEXUS_ACP_BRIDGE_HOST`
- `NEXUS_ACP_BRIDGE_PORT`
- `NEXUS_ACP_BRIDGE_IDLE_TIMEOUT_SECONDS` (default `0`, which disables Bun's idle timeout; set a positive value to re-enable it)
- `NEXUS_ACP_BRIDGE_CORS_ORIGIN`
- `NEXUS_ACP_BRIDGE_PROJECT_DIR`
- `NEXUS_ACP_BRIDGE_PROJECT_DIRS`
- `NEXUS_ACP_BRIDGE_ALLOW_ARBITRARY_DIRECTORIES`
- `NEXUS_ACP_BRIDGE_PROVIDER_ID`
- `NEXUS_ACP_BRIDGE_PROVIDER_NAME`
- `NEXUS_ACP_BRIDGE_MODEL_ID`
- `NEXUS_ACP_BRIDGE_MODEL_NAME`
- `NEXUS_ACP_BRIDGE_TOOLS`
- `NEXUS_ACP_BRIDGE_AGENT_COMMAND`
- `NEXUS_ACP_BRIDGE_AGENT_ARGS`
- `NEXUS_ACP_BRIDGE_AGENT_CWD`
- `NEXUS_ACP_BRIDGE_ACP_PROTOCOL` (`newline` — default, matches Zed ACP; or `content-length`)
- `NEXUS_ACP_BRIDGE_ACP_PROTOCOL_VERSION` (integer, default `1`)
- `NEXUS_ACP_BRIDGE_MAX_FILE_READ_BYTES` (default `2097152` — size cap for `/file/content` and `fs/read_text_file`)

## Adapter shape

The mock adapter lives in `src/mock-acp-adapter.ts`, the one-shot process-backed adapter lives in `src/stdio-acp-adapter.ts`, and the persistent JSON-RPC ACP adapter lives in `src/acp-protocol-adapter.ts`. All implement the `ACPAdapter` interface from `src/types.ts`.

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
5. streams agent output from `session/update` notifications with the `agent_message_chunk` variant (text content blocks)
6. caches slash-command advertisements from `session/update` notifications with the `available_commands_update` variant and exposes them via `GET /command`
7. sends `session/cancel` when Nexus aborts a prompt

The bridge responds to agent-initiated requests:

- `fs/read_text_file` — reads files inside configured project roots, honoring optional `line` / `limit` parameters
- `fs/write_text_file` — writes files inside configured project roots
- `session/request_permission` — auto-approves with the first `allow_once` / `allow_always` option (or the first option if none are explicitly "allow")

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



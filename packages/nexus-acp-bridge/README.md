# Nexus ACP Bridge

`nexus-acp-bridge` is a small Bun HTTP/SSE server that exposes the subset of the OpenCode-style API Nexus currently uses, so Nexus can connect to a bridge URL while the bridge talks to an ACP-compatible backend.

## What it provides

- `GET /global/health`
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

Then point Nexus to the bridge URL, usually:

```text
http://127.0.0.1:4080
```

## Environment

Use `examples/.env.claude.example` as a starting point.

Important variables:

- `NEXUS_ACP_BRIDGE_ADAPTER` (`mock`, `stdio`, or `acp`)
- `NEXUS_ACP_BRIDGE_HOST`
- `NEXUS_ACP_BRIDGE_PORT`
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
- `NEXUS_ACP_BRIDGE_ACP_PROTOCOL` (`content-length` or `newline`)
- `NEXUS_ACP_BRIDGE_ACP_METHOD_INITIALIZE`
- `NEXUS_ACP_BRIDGE_ACP_METHOD_HEALTH`
- `NEXUS_ACP_BRIDGE_ACP_METHOD_MODELS`
- `NEXUS_ACP_BRIDGE_ACP_METHOD_TOOLS`
- `NEXUS_ACP_BRIDGE_ACP_METHOD_RESOURCES`
- `NEXUS_ACP_BRIDGE_ACP_METHOD_MCP_STATUS`
- `NEXUS_ACP_BRIDGE_ACP_METHOD_GENERATE`
- `NEXUS_ACP_BRIDGE_ACP_METHOD_CANCEL`
- `NEXUS_ACP_BRIDGE_ACP_NOTIFICATION_DELTA`
- `NEXUS_ACP_BRIDGE_ACP_NOTIFICATION_COMPLETED`
- `NEXUS_ACP_BRIDGE_ACP_NOTIFICATION_FAILED`

## Adapter shape

The mock adapter lives in `src/mock-acp-adapter.ts`, the one-shot process-backed adapter lives in `src/stdio-acp-adapter.ts`, and the persistent JSON-RPC ACP adapter lives in `src/real-acp-adapter.ts`. All implement the `ACPAdapter` interface from `src/types.ts`.

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
2. speaks JSON-RPC over stdio
3. supports either `Content-Length` framing or newline-delimited JSON
4. maps configured ACP methods and notifications into the bridge contract Nexus expects

This mode is the recommended starting point for a real ACP runtime.

The bridge currently assumes:

- request/response methods for health, models, tools, resources, MCP status, and generate
- notifications for streamed text deltas, completion, and failure
- a correlation token passed in `params.metadata.requestId`

If your ACP runtime uses different method names or notification names, override them via environment variables instead of changing Nexus frontend code.

## Current behavior

The mock adapter is intentionally deterministic so Nexus can exercise its flows:

- workflow generation returns a minimal valid workflow JSON object
- example generation returns a JSON string array
- prompt generation/editing returns Markdown/plain text

That makes it useful for local development even before a real ACP transport is plugged in.

The `stdio` adapter is useful when you already have a local command-based agent runtime and want Nexus to talk to it through this bridge without changing the frontend.

The `acp` adapter is what you should use once you have a real ACP runtime that supports persistent JSON-RPC messaging.



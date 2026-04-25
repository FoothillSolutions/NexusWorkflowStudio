# CLAUDE.md — `packages/nexus-acp-bridge`

Bun HTTP/SSE server that exposes the OpenCode-style API Nexus uses, fronting a real ACP backend (Claude Code, Codex, OpenCode) over JSON-RPC stdio.

## Source of truth

Prefer these over this file when details may drift:
- `package.json` — scripts, `bin`, exports
- `README.md` — user-facing run instructions, env vars, layout
- `src/types.ts` — `ACPAdapter`, `BridgeConfig`, all wire types
- `src/index.ts` — public API barrel + `createAdapter()` dispatch
- `src/config.ts` — CLI flags / env / preset → `BridgeConfig` resolution

## Quick start

```bash
bun run nexus-acp-bridge                  # repo root: launches with bundled defaults
bun run nexus-acp-bridge --agent claude   # claude | codex | opencode
bun run nexus-acp-bridge:setup-claude     # vendor @agentclientprotocol/claude-agent-acp

# Inside the package:
cd packages/nexus-acp-bridge
bun run typecheck
bun test
```

Validate non-trivial changes with:
1. `bun run typecheck` (or root `bun run typecheck:bridge`)
2. `bun test` for the touched module's `__tests__/` file

## Layout

```
src/
├── bin.ts                  # CLI entrypoint (#!/usr/bin/env bun)
├── index.ts                # Public barrel + createAdapter()
├── config.ts               # CLI/env/preset → BridgeConfig
├── tool-presets.ts         # claude-code / codex / opencode presets
├── types.ts                # Shared interfaces
├── vendor-claude-acp.ts    # Auto-vendoring helper for claude-agent-acp
├── adapters/
│   ├── mock.ts             # MockACPAdapter — deterministic fixtures
│   ├── stdio.ts            # StdioACPAdapter — one-shot child per prompt
│   └── acp-protocol.ts     # ACPProtocolAdapter — persistent JSON-RPC ACP
├── transport/
│   ├── async-queue.ts
│   ├── jsonrpc.ts          # newline + Content-Length framing
│   ├── jsonrpc-client.ts
│   └── stdio-transport.ts
├── server/
│   ├── http-server.ts      # NexusACPBridgeServer (Bun HTTP + SSE)
│   └── default-provider.ts # Locally served provider/tool/resource defaults
└── __tests__/              # one Bun test file per module
```

## Architecture notes that matter

- **Three adapters, one interface.** `mock`, `stdio`, and `acp` all implement `ACPAdapter` from `src/types.ts`. Selection happens in `createAdapter(config)` — keep the dispatch there, not inside `bin.ts`.
- **HTTP layer is OpenCode-shaped.** `server/http-server.ts` mimics the OpenCode REST/SSE surface so the Nexus frontend stays adapter-agnostic. Route shape changes must keep that contract.
- **ACP is JSON-RPC 2.0 over child stdio.** `transport/jsonrpc{,client}.ts` handle framing (newline default, `Content-Length` opt-in via `NEXUS_ACP_BRIDGE_ACP_PROTOCOL`). `acp-protocol.ts` owns initialize / `session/new` / `session/prompt` / `session/cancel` and the `fs/*` + `session/request_permission` reverse handlers.
- **Slash commands are dynamic.** ACP advertises them via `session/update` → `available_commands_update`; the adapter caches them per session and `GET /command` reads that cache.
- **Tools, providers, MCP, resources are local.** ACP doesn't expose discovery for these — `server/default-provider.ts` synthesises them from `BridgeConfig`.

## Guardrails

- **No new `bridge*` script names.** The canonical command is `bun run nexus-acp-bridge[:claude|:codex|:opencode|:setup-claude]`.
- **Don't bypass `BridgeConfig`.** All env / CLI / preset resolution belongs in `src/config.ts`. Adapters and the server should only read the resolved config.
- **`fs/*` handlers must stay sandboxed.** `acp-protocol.ts` enforces that requested paths live under `config.projectDirs`. Don't relax that without an explicit config flag.
- **`projectDirs` paths are absolute and pre-resolved by `config.ts`.** Don't re-resolve at use sites.
- **Streaming must remain abortable.** `generateText` uses `AsyncQueue` + an `AbortSignal`-driven `session/cancel`. New streaming paths should follow the same shape.
- **Vendor directory is generated.** `vendor/claude-code/` is populated by `vendor-claude-acp.ts` / `scripts/setup-claude-acp.ts`; never hand-edit it.
- **Public API surface = `src/index.ts`.** Anything consumers should import goes through the barrel; don't deep-import from sibling packages.

## Adding a new adapter

At minimum:
1. Create `src/adapters/<name>.ts` implementing `ACPAdapter`.
2. Add a discriminator value to `BridgeConfig.adapterMode` in `src/types.ts` and parse it in `src/config.ts`.
3. Wire it into `createAdapter()` in `src/index.ts`.
4. Re-export the class from `src/index.ts`.
5. Add `src/__tests__/<name>.test.ts` covering happy path + abort.


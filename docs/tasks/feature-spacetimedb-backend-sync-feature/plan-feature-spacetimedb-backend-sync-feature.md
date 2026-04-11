# feature: SpacetimeDB Backend Sync

## Metadata
adw_id: `feature`
issue_description: `SpaceTime — Use SpacetimeDB as the authoritative backend and synchronization layer for workspace mode`

## Description
Migrate the Nexus Workflow Studio workspace-mode persistence and real-time collaboration layer from the current filesystem + Hocuspocus/Yjs stack to SpacetimeDB. SpacetimeDB provides a unified WebSocket-based data layer with row-level subscriptions, server-side reducers, and automatic client-side caching — replacing both the REST API persistence layer and the Hocuspocus real-time sync in a single system.

The current architecture has two parallel persistence paths:
1. **REST/filesystem persistence** — Workspace manifests, workflow JSON files, Brain documents, and snapshot versions stored on disk via Next.js API routes (`src/app/api/workspaces/`, `src/app/api/brain/`)
2. **Real-time collaboration** — Hocuspocus server + Yjs documents synced over WebSocket for live multi-user editing (`src/lib/collaboration/`, `scripts/collab-server.ts`)

SpacetimeDB unifies these into normalized database tables with reducer-based mutations and subscription-driven client updates. The standalone editor/localStorage mode must remain fully functional.

## Objective
Replace workspace-mode storage and sync paths with SpacetimeDB while preserving standalone editor/localStorage behavior. After completion:
- All workspace CRUD, workflow saves, Brain document operations, and real-time collaboration flow through SpacetimeDB
- The Hocuspocus/Yjs layer is removed from workspace mode (retained only for standalone `?room=` collaboration until deliberately migrated)
- Invite-link access uses SpacetimeDB membership validation before workspace-scoped reducer mutations
- Existing workspace data can be migrated via an idempotent migration script
- Presence/awareness broadcasts through SpacetimeDB presence rows

## Problem Statement
The current dual-layer architecture (REST + Hocuspocus) creates operational complexity: two separate server processes, two persistence formats (JSON files + binary Yjs state), and two sync mechanisms that must be kept consistent. The `_isApplyingRemote` mutex pattern in `collab-doc.ts` prevents feedback loops but adds fragility. SpacetimeDB can unify persistence and sync into one system with built-in conflict resolution.

## Solution Statement
Introduce a SpacetimeDB TypeScript module defining normalized workspace tables and reducers. Create a client-side bridge (`src/lib/spacetime/workspace-sync.ts`) that connects to SpacetimeDB, subscribes to workspace rows, and bidirectionally syncs with the Zustand workflow store using a loop-prevention pattern similar to the existing `_isApplyingRemote` approach. Replace Hocuspocus in workspace mode while keeping REST API routes as temporary shims during the transition.

## Code Patterns to Follow
Reference implementations:
- **Loop prevention pattern**: `src/lib/collaboration/collab-doc.ts` — `_isApplyingRemote` flag pattern for preventing feedback loops between remote updates and local store changes
- **Workspace room ID generation**: `src/lib/collaboration/config.ts` — `buildWorkspaceRoomId()` for stable, deterministic connection identifiers
- **Store structure**: `src/store/workflow/store.ts` — Zustand + Zundo temporal middleware, `loadWorkflow()`, `getWorkflowJSON()` interface
- **Collaboration store**: `src/store/collaboration/collab-store.ts` — connection state management (isConnected, peerCount, isInitializing)
- **Awareness store**: `src/store/collaboration/awareness-store.ts` — presence data management
- **Editor integration**: `src/components/workflow/workflow-editor.tsx` — workspace mode detection (`isWorkspaceMode`), lifecycle management (start/destroy on mount/unmount)
- **Workspace persistence**: `src/lib/workspace/server.ts` — CRUD operations, manifest pattern
- **Brain persistence**: `src/lib/brain/server.ts` — Session management, JWT tokens, soft deletes, versioning
- **Snapshot/change tracking**: `src/lib/workspace/snapshots.ts` — `computeChanges()` for structural diff events

## Relevant Files
Use these files to complete the task:

### Existing Files to Modify

- **`src/lib/workspace/server.ts`** — Current filesystem workspace CRUD; will be wrapped/replaced by SpacetimeDB reducers
- **`src/lib/workspace/snapshots.ts`** — Current snapshot/version tracking; will transition to SpacetimeDB event rows
- **`src/lib/workspace/types.ts`** — WorkspaceRecord, WorkflowRecord types; will need SpacetimeDB equivalents
- **`src/lib/workspace/config.ts`** — Data directory configuration; add SpacetimeDB connection config
- **`src/lib/workspace/schemas.ts`** — Zod validation schemas; extend for SpacetimeDB payloads
- **`src/lib/brain/server.ts`** — Brain document CRUD, sessions, versions, feedback; migrate to SpacetimeDB tables
- **`src/lib/brain/types.ts`** — Brain type definitions; add SpacetimeDB equivalents
- **`src/lib/brain/client.ts`** — Browser-side Brain API wrapper; transition to SpacetimeDB client calls
- **`src/lib/brain/config.ts`** — Brain configuration; add SpacetimeDB connection vars
- **`src/lib/collaboration/collab-doc.ts`** — CollabDoc singleton; workspace mode will use SpacetimeDB sync instead
- **`src/lib/collaboration/config.ts`** — Collaboration URL/room config; add SpacetimeDB URI config
- **`src/lib/collaboration/object-store.ts`** — Binary Yjs persistence; will be obsoleted for workspace mode
- **`src/store/workflow/store.ts`** — Main Zustand store; needs SpacetimeDB subscription integration
- **`src/store/collaboration/collab-store.ts`** — Connection state; adapt for SpacetimeDB connection lifecycle
- **`src/store/collaboration/awareness-store.ts`** — Presence; transition to SpacetimeDB presence rows
- **`src/store/knowledge/store.ts`** — Brain documents store; transition to SpacetimeDB subscriptions
- **`src/components/workflow/workflow-editor.tsx`** — Editor integration; switch workspace mode from CollabDoc to SpacetimeDB sync
- **`src/app/api/workspaces/route.ts`** — List/create workspace REST API; temporary shim, then removal
- **`src/app/api/workspaces/[id]/route.ts`** — Get workspace REST API; temporary shim
- **`src/app/api/workspaces/[id]/workflows/[workflowId]/route.ts`** — Workflow CRUD REST API; temporary shim
- **`src/app/api/workspaces/[id]/workflows/[workflowId]/snapshots/route.ts`** — Snapshot REST API; temporary shim
- **`src/app/api/workspaces/[id]/changes/route.ts`** — Changes REST API; replace with event row queries
- **`src/app/api/brain/session/route.ts`** — Brain session REST API; temporary shim
- **`src/app/api/brain/documents/route.ts`** — Brain documents REST API; temporary shim
- **`docker-compose.yml`** — Add SpacetimeDB service container
- **`Dockerfile`** — Include SpacetimeDB CLI for binding generation
- **`.env.example`** — Add SpacetimeDB environment variables
- **`package.json`** — Add `@clockworklabs/spacetimedb-sdk` dependency
- **`CLAUDE.md`** — Update architecture notes for SpacetimeDB

### New Files

- **`spacetime/nexus/`** — SpacetimeDB TypeScript module directory
  - **`spacetime/nexus/src/index.ts`** — Main SpacetimeDB 2.1 TypeScript module: table definitions, reducers, lifecycle hooks
  - **`spacetime/nexus/spacetimedb.toml`** — Module configuration
  - **`spacetime/nexus/tsconfig.json`** — TypeScript config for the module
- **`src/lib/spacetime/client.ts`** — SpacetimeDB client connection manager (DbConnection wrapper, identity token persistence, reconnection logic)
- **`src/lib/spacetime/workspace-sync.ts`** — Bidirectional sync bridge: SpacetimeDB subscriptions ↔ Zustand store with loop-prevention
- **`src/lib/spacetime/brain-sync.ts`** — Brain document sync bridge: SpacetimeDB subscriptions ↔ Brain store
- **`src/lib/spacetime/presence.ts`** — Presence/awareness via SpacetimeDB presence rows
- **`src/lib/spacetime/config.ts`** — SpacetimeDB connection configuration (URI, DB name, module path)
- **`src/lib/spacetime/types.ts`** — TypeScript types for SpacetimeDB row shapes and reducer payloads
- **`src/lib/spacetime/module_bindings/`** — Generated TypeScript client bindings (auto-generated, do not hand-edit)
- **`scripts/migrate-to-spacetime.ts`** — Idempotent migration script: reads existing filesystem data → calls SpacetimeDB import reducers
- **`scripts/generate-spacetime-bindings.sh`** — Binding generation script for dev/CI
- **`docs/tasks/feature-spacetimedb-backend-sync-feature/e2e-feature-spacetimedb-backend-sync-feature.md`** — E2E test specification

### Reference Files (read for context, do not modify unless necessary)

- **`CLAUDE.md`** — Project coding rules and conventions
- **`docs/tasks/conditional_docs.md`** — Conditional documentation guide
- **`docs/tasks/persistent-brain/doc-persistent-brain.md`** — Brain persistence documentation (read per conditional_docs.md — this task modifies Brain persistence)
- **`scripts/collab-server.ts`** — Current Hocuspocus server (reference for replacement)

## Implementation Plan

### Phase 1: Foundation
Set up the SpacetimeDB module, define the database schema as normalized tables, implement reducers for all mutations, and generate TypeScript client bindings. Establish the client connection manager with identity persistence and reconnection.

Key decisions:
- Use TypeScript module support so backend schema/reducers stay close to the existing TS codebase
- Store `WorkflowNodeData` as JSON strings initially (not strict SpacetimeDB types) to minimize migration risk
- Validate workspace membership in reducers before workspace-scoped mutations
- Keep invite token flow: client connects → calls `join_workspace(token)` → reducer validates + records membership → subsequent workspace-scoped reducers accept that identity

### Phase 2: Core Implementation
Build the client-side sync bridges that connect SpacetimeDB subscriptions to Zustand stores. Implement the workspace sync bridge with loop-prevention (mirroring the `_isApplyingRemote` pattern), the Brain document sync bridge, and the presence layer. Key concerns:
- Batch graph changes on drag-stop or throttled intervals (avoid per-pixel reducer calls)
- Use `apply_workflow_ops(workflowId, ops[])` for batched node/edge upserts/deletes
- Write `workflow_change_event` rows from reducers for the recent-changes feed
- Implement presence via ephemeral rows with `lastSeenAt` timestamps and disconnect cleanup

### Phase 3: Integration
Wire SpacetimeDB sync into the workflow editor, replacing Hocuspocus for workspace mode. Update stores, hooks, and components. Keep REST API routes as temporary compatibility shims so the UI migration can be incremental. Add Docker service configuration. Write migration script for existing data.

Key constraints:
- Standalone editor/localStorage mode must remain fully functional
- Keep CollabDoc only for standalone `?room=` collaboration
- OpenCode local server calls stay browser/Next-side (SpacetimeDB cannot reach user's machine)
- Marketplace Git operations stay filesystem-based
- Generated ZIP exports stay in browser/Bun code
- Browser-only preferences stay in localStorage

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Set Up SpacetimeDB Module Structure
- Create `spacetime/nexus/` directory with `spacetimedb.toml`, `tsconfig.json`
- Create `spacetime/nexus/src/index.ts` with all table definitions:
  - `workspace`: id (string, primary), name, createdAt, updatedAt
  - `workspace_member`: workspaceId, identity, displayName, role, joinedAt
  - `workspace_invite`: workspaceId, tokenHash, createdAt, revokedAt
  - `workflow`: id (string, primary), workspaceId, name, createdAt, updatedAt, lastModifiedBy
  - `workflow_node`: workflowId, nodeId, type, positionJson, dataJson, updatedAt, updatedBy
  - `workflow_edge`: workflowId, edgeId, source, target, handlesJson, dataJson, updatedAt, updatedBy
  - `workflow_ui_state`: workflowId, uiStateJson
  - `brain_doc`: id, workspaceId, title, contentJson, createdAt, updatedAt, deletedAt
  - `brain_doc_version`: docId, versionId, contentJson, createdAt
  - `brain_feedback`: docId, identity, type, comment, createdAt
  - `workflow_change_event`: workflowId, eventType, nodeId, details, timestamp (append-only)
  - `presence`: workspaceId, workflowId, identity, displayName, selectedNodeId, lastSeenAt
- Validate membership in reducers with `ctx.sender` before workspace-scoped mutations
- Implement identity lifecycle hooks (`__identity_connected__`, `__identity_disconnected__`)

### 2. Implement SpacetimeDB Reducers
- Workspace reducers: `create_workspace`, `rename_workspace`, `delete_workspace`
- Invite reducers: `create_invite`, `join_workspace`
- Workflow reducers: `create_workflow`, `rename_workflow`, `delete_workflow`
- Batch operation reducer: `apply_workflow_ops(workflowId, ops[])` for node/edge upserts/deletes
  - Each operation writes a `workflow_change_event` row for the recent-changes feed
- UI state reducer: `update_workflow_ui_state`
- Brain reducers: `save_brain_doc`, `delete_brain_doc`, `record_brain_view`, `add_brain_feedback`, `restore_brain_doc_version`
- Presence reducer: `update_presence` (called on selection change, throttled)
- Disconnect cleanup: clear presence rows in `__identity_disconnected__`

### 3. Generate TypeScript Client Bindings
- Create `scripts/generate-spacetime-bindings.sh` to run `spacetime generate --lang typescript --out-dir src/lib/spacetime/module_bindings --module-path spacetime/nexus`
- Generate bindings and commit to `src/lib/spacetime/module_bindings/`
- Add `@clockworklabs/spacetimedb-sdk` to `package.json` dependencies
- Add `.gitignore` entry or build script note for regeneration

### 4. Create SpacetimeDB Client Connection Manager
- Create `src/lib/spacetime/config.ts` with configuration:
  - `NEXT_PUBLIC_SPACETIME_URI` (WebSocket URI)
  - `NEXT_PUBLIC_SPACETIME_DB_NAME` (database name)
  - Helper to check if SpacetimeDB is configured
- Create `src/lib/spacetime/client.ts`:
  - Singleton `DbConnection` wrapper
  - Identity token persistence in localStorage (keyed by DB name)
  - Automatic reconnection with exponential backoff
  - Connection lifecycle methods: `connect()`, `disconnect()`, `isConnected()`
  - Event emitters for connection state changes

### 5. Create SpacetimeDB Type Definitions
- Create `src/lib/spacetime/types.ts` with TypeScript interfaces matching SpacetimeDB table schemas
- Define reducer argument types
- Define operation types for `apply_workflow_ops` (AddNode, UpdateNode, DeleteNode, AddEdge, UpdateEdge, DeleteEdge)
- Map between SpacetimeDB row types and existing `WorkflowNode`, `WorkflowEdge`, `WorkspaceRecord`, `WorkflowRecord` types

### 6. Implement Workspace Sync Bridge
- Create `src/lib/spacetime/workspace-sync.ts`:
  - Connect with generated `DbConnection`
  - Subscribe to workspace/workflow rows using generated subscription queries
  - Implement `_isApplyingRemote` flag pattern (mirror `collab-doc.ts` approach):
    - On row insert/update/delete callbacks: set flag → update Zustand store → clear flag
    - On Zustand store change subscription: check flag → skip if applying remote → else emit reducer call
  - Batch node/edge changes: collect mutations during drag operations, flush on drag-stop or 200ms throttle
  - Convert between SpacetimeDB row format (JSON strings for node data) and Zustand workflow format (typed objects)
  - Methods: `startSync(workspaceId, workflowId)`, `stopSync()`, `isActive()`
  - Clean transient React Flow properties before syncing (same list as `collab-doc.ts`: measured, selected, dragging, etc.)

### 7. Implement Brain Document Sync Bridge
- Create `src/lib/spacetime/brain-sync.ts`:
  - Subscribe to `brain_doc`, `brain_doc_version`, `brain_feedback` rows for the current workspace
  - Sync row changes into the Brain Zustand store (`src/store/knowledge/store.ts`)
  - Replace REST-based `saveBrainDoc()`, `deleteBrainDoc()`, `listVersions()`, `restoreVersion()`, `addFeedback()` with reducer calls
  - Handle soft deletes (set `deletedAt` via reducer, filter in view)
  - Methods: `startBrainSync(workspaceId)`, `stopBrainSync()`

### 8. Implement Presence Layer
- Create `src/lib/spacetime/presence.ts`:
  - Subscribe to `presence` rows for the current workspace
  - On local selection change: call `update_presence` reducer (throttled to ~500ms)
  - On remote presence row changes: update awareness store (`src/store/collaboration/awareness-store.ts`)
  - On disconnect: server-side cleanup via `__identity_disconnected__`
  - Map SpacetimeDB identity → display name using `workspace_member` rows
  - Methods: `startPresence(workspaceId, workflowId)`, `stopPresence()`, `updateSelection(nodeId)`

### 9. Update Workflow Editor for SpacetimeDB Integration
- Modify `src/components/workflow/workflow-editor.tsx`:
  - In workspace mode: start SpacetimeDB sync instead of CollabDoc
  - On mount: `spacetimeWorkspaceSync.startSync(workspaceId, workflowId)` + `spacetimePresence.startPresence()`
  - On unmount: `spacetimeWorkspaceSync.stopSync()` + `spacetimePresence.stopPresence()`
  - Keep CollabDoc path only for standalone `?room=` collaboration
  - Update `useWorkspaceAutosave` hook: in SpacetimeDB mode, the reducer calls handle persistence — remove or skip REST-based auto-save
- Update `src/store/collaboration/collab-store.ts` to track SpacetimeDB connection state alongside (or replacing) Hocuspocus state
- Update awareness sync to use SpacetimeDB presence instead of Yjs awareness in workspace mode

### 10. Implement Invite-Link Access Control
- In the SpacetimeDB module: validate invite tokens and member identity before workspace-scoped mutations
- Update workspace join flow:
  - Client opens `/workspace/[id]?invite=...`
  - Client connects to SpacetimeDB (anonymous identity, token persisted)
  - Client calls `join_workspace(inviteToken)` reducer
  - Reducer validates token hash → records `workspace_member` row
  - Views then expose workspace data to the new member
- Update `src/lib/brain/client.ts` brain session bootstrap to work with SpacetimeDB identity instead of JWT tokens

### 11. Keep REST API Routes as Temporary Shims
- Update workspace API routes (`src/app/api/workspaces/`) to proxy through to SpacetimeDB where possible, or mark as deprecated
- Update Brain API routes (`src/app/api/brain/`) similarly
- Add deprecation comments noting these will be removed once all client code uses SpacetimeDB directly
- Ensure non-workspace-mode paths (if any use these routes) continue to work

### 12. Replace Recent Changes with Event Rows
- In SpacetimeDB module: workflow reducers already write `workflow_change_event` rows (from Step 2)
- Update `src/app/api/workspaces/[id]/changes/route.ts` to query SpacetimeDB event rows instead of computing diffs from filesystem snapshots
- Or: have the client subscribe to `workflow_change_event` rows directly and remove the REST endpoint
- Remove dependency on `src/lib/workspace/snapshots.ts` for real-time change tracking (keep snapshots only for optional export/recovery)

### 13. Write Data Migration Script
- Create `scripts/migrate-to-spacetime.ts`:
  - Read existing data from:
    - `.nexus-brain/workspaces/**` (Brain documents)
    - `.nexus-brain/manifest.json` (Brain metadata)
    - Workspace data directory (workflow JSON files, manifests)
    - Snapshot files from `src/lib/workspace/snapshots.ts` paths
  - Call SpacetimeDB import reducers to populate tables
  - Preserve existing IDs so workspace URLs keep working
  - Make the script idempotent (check if rows exist before inserting)
  - Log progress and any skipped/failed items

### 14. Update Docker/Deployment Configuration
- Update `docker-compose.yml`:
  - Add `nexus-spacetimedb` service running SpacetimeDB server
  - Mount data volume for SpacetimeDB persistence
  - Set environment variables: `NEXT_PUBLIC_SPACETIME_URI`, `NEXT_PUBLIC_SPACETIME_DB_NAME`
  - Run SpacetimeDB as a separate service; publish the module with the SpacetimeDB CLI during setup or after schema changes
- Update `Dockerfile`:
  - Install SpacetimeDB CLI for binding generation during build
  - Keep generated bindings committed so regular app builds do not require the SpacetimeDB CLI
- Update `.env.example` with new variables:
  - `NEXT_PUBLIC_SPACETIME_URI=ws://localhost:3001`
  - `NEXT_PUBLIC_SPACETIME_DB_NAME=nexus`
  - `SPACETIME_MODULE_PATH=spacetime/nexus`
- Consider a CI check that fails when generated bindings are stale

### 15. Add Unit and Integration Tests
- Test SpacetimeDB client connection manager (connect, disconnect, reconnect, identity persistence)
- Test workspace sync bridge loop-prevention (verify no feedback loops)
- Test batch operation coalescing (multiple rapid changes → single reducer call)
- Test presence throttling (rapid selection changes → throttled updates)
- Test type conversions between SpacetimeDB rows and Zustand workflow types
- Test migration script with sample data fixtures

### 16. Create E2E Test Specification
- Create `docs/tasks/feature-spacetimedb-backend-sync-feature/e2e-feature-spacetimedb-backend-sync-feature.md` with:
  - **User Story**: Validate that workspace mode works end-to-end with SpacetimeDB as the persistence and sync backend
  - **Test Steps**:
    1. Open app, create a new workspace — verify workspace appears in list
    2. Create a workflow in the workspace — verify workflow is saved
    3. Add nodes (Start, Agent, End) and connect them — verify nodes persist after page reload
    4. Open the same workspace in a second browser tab — verify both tabs show the same workflow
    5. Add a node in tab 1 — verify it appears in tab 2 within 2 seconds
    6. Move a node in tab 2 — verify position updates in tab 1
    7. Delete a node in tab 1 — verify it disappears from tab 2
    8. Check recent changes panel — verify change events appear
    9. Create a Brain document — verify it persists and appears in both tabs
    10. Generate an invite link — open in incognito — verify workspace loads after joining
    11. Disconnect network briefly — reconnect — verify sync resumes without data loss
    12. Switch to standalone mode (no workspace) — verify localStorage persistence still works
  - **Success Criteria**: All steps pass, no data loss, sub-2-second sync latency, standalone mode unaffected
  - **Screenshots**: Capture at workspace creation, multi-tab sync, invite join, and reconnection states

### 17. Update Documentation
- Update `CLAUDE.md` architecture notes to reflect SpacetimeDB as the workspace persistence/sync layer
- Add SpacetimeDB section to deployment docs
- Document new environment variables
- Note that Hocuspocus remains only for standalone `?room=` collaboration

### 18. Run Validation Commands
- Execute all validation commands to confirm zero regressions
- Verify standalone editor mode is unaffected
- Verify workspace mode operates through SpacetimeDB

## Testing Strategy

### Unit Tests
- SpacetimeDB client connection lifecycle (connect, disconnect, reconnect, identity token persistence)
- Workspace sync bridge: loop-prevention flag behavior, batch coalescing, transient property cleaning
- Brain sync bridge: CRUD operations via reducers, soft delete handling, version restore
- Presence: throttling behavior, disconnect cleanup
- Type conversion utilities: SpacetimeDB rows ↔ Zustand types
- Migration script: idempotency, ID preservation, error handling

### Edge Cases
- Simultaneous edits to the same node from two clients (last-write-wins at row level)
- Rapid drag operations (batch coalescing must not lose intermediate state)
- Network disconnection during a reducer call (reconnection + retry behavior)
- Invite token reuse after revocation (reducer must reject)
- Empty workspace (no workflows) — subscription returns no rows, UI handles gracefully
- Large workflows (500+ nodes) — subscription performance, batch size limits
- Migration of corrupted or partial filesystem data — script must log and continue
- Browser tab close during sync — cleanup without leaving orphaned presence rows
- Concurrent workspace deletion while another user is editing — graceful degradation

## Acceptance Criteria
- All workspace CRUD operations (create, rename, delete) work through SpacetimeDB reducers
- All workflow operations (create, save, rename, delete) persist via SpacetimeDB tables
- Real-time multi-user collaboration works via SpacetimeDB subscriptions (no Hocuspocus in workspace mode)
- Node/edge changes sync between clients within 2 seconds
- Batch operation reducer handles drag-stop and throttled interval flushes
- Brain document CRUD, versioning, and feedback work through SpacetimeDB
- Presence/awareness shows selected nodes and connected peers via SpacetimeDB rows
- Invite-link access control validates membership before workspace-scoped reducer mutations
- Existing workspace data can be migrated via `scripts/migrate-to-spacetime.ts`
- Recent changes panel uses `workflow_change_event` rows instead of filesystem snapshots
- Standalone editor/localStorage mode is completely unaffected
- CollabDoc still works for standalone `?room=` collaboration
- Docker deployment includes SpacetimeDB service
- TypeScript typecheck passes (`bun run typecheck`)
- Lint passes (`bun run lint`)
- Build succeeds (`bun run build`)
- All existing tests pass

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

```bash
bun run typecheck
bun run lint
bun run build
```

## Notes
- SpacetimeDB TypeScript module support means the backend schema and reducers are written in TypeScript, keeping them close to the existing codebase and reducing context-switching
- Use JSON strings for `WorkflowNodeData` in SpacetimeDB columns initially — this avoids encoding the full discriminated union as strict SpacetimeDB types and reduces migration risk
- The `_isApplyingRemote` pattern from `collab-doc.ts` is well-tested and should be faithfully replicated in the SpacetimeDB sync bridge
- OpenCode local server calls, marketplace Git operations, generated ZIP exports, and browser-only preferences must stay outside SpacetimeDB (see issue description section 10)
- SpacetimeDB docs references: [Clients](https://spacetimedb.com/docs/clients/), [TypeScript Reference](https://spacetimedb.com/docs/clients/typescript/), [Table Access Permissions](https://spacetimedb.com/docs/tables/access-permissions/), [Using Auth Claims](https://spacetimedb.com/docs/how-to/using-auth-claims/), [Procedures](https://spacetimedb.com/docs/functions/procedures/), [File Storage](https://spacetimedb.com/docs/tables/file-storage/)
- Consider using SpacetimeDB procedures for any operations that need to call external HTTP services (e.g., if future workspace features need outbound calls)
- For very large linked files, use external object storage and store references in SpacetimeDB rows

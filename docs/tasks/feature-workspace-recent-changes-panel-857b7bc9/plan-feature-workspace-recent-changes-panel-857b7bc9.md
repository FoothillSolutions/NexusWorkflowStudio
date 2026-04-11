# feature: Workspace Recent Changes Panel

## Metadata
adw_id: `857b7bc9`
issue_description: `Workspace Recent Changes — snapshot-per-save system, server-side diff computation, per-browser last-seen tracking, and a dashboard changes panel that surfaces node-level workflow changes since last visit.`

## Description
When a team member returns to a workspace after time away, they have no visibility into what changed while they were gone. This feature adds a lightweight audit trail via periodic server snapshots (triggered on every PUT workflow save) and a dashboard-side diff panel that surfaces workflow-level summaries (who edited, when) and expandable node-level changes (added, removed, renamed nodes) since the user's last visit.

## Objective
Implement the full snapshot + diff + changes panel pipeline so that returning users see a "what changed" panel on the workspace dashboard, showing per-workflow node-level events (added, deleted, renamed) attributed to the user who saved them.

## Problem Statement
Returning workspace users have zero visibility into changes made by teammates while they were away. They must manually open each workflow and inspect it to understand what changed, which is slow and error-prone.

## Solution Statement
1. **Snapshot system**: On every `PUT /api/workspaces/[id]/workflows/[wid]` save, write an append-only timestamped snapshot of the workflow JSON to disk.
2. **Diff computation API**: A new `GET /api/workspaces/[id]/changes?since=...` endpoint walks snapshots chronologically, diffs adjacent pairs at the node level, and returns structured change events.
3. **Last-seen tracking**: Per-browser localStorage key tracks when the user last opened the dashboard; used as the `since` baseline.
4. **Changes panel UI**: A slide-in panel on the dashboard shows grouped node-level changes with user attribution and colored initial badges.

## Code Patterns to Follow
Reference implementations:
- **Server file operations**: `src/lib/workspace/server.ts` — `writeJsonFile`, `readJsonFile`, `ensureDir`, atomic file writes, manifest read/update pattern.
- **API route pattern**: `src/app/api/workspaces/[id]/workflows/[wid]/route.ts` — Zod validation, try/catch, `NextResponse.json`.
- **Dashboard components**: `src/components/workspace/dashboard.tsx`, `workflow-card.tsx` — theme tokens, responsive grid, component composition.
- **Color hashing**: `src/lib/collaboration/awareness-names.ts` — `getColorForClientId()` for deterministic color from a name string.
- **Hooks pattern**: `src/hooks/use-workspace.ts` — fetch + state + loading/error + refetch.
- **Zod schemas**: `src/lib/workspace/schemas.ts` — import from `"zod/v4"`.
- **Theme tokens**: `src/lib/theme.ts` — `BG_APP`, `BG_SURFACE`, `TEXT_PRIMARY`, `TEXT_MUTED`, `BORDER_DEFAULT`.
- **Workspace types**: `src/lib/workspace/types.ts` — interface-based type definitions.
- **Workspace config**: `src/lib/workspace/config.ts` — `getWorkspaceConfig().dataDir` for data directory path.

## Relevant Files
Use these files to complete the task:

### Existing Files to Modify
- **`src/lib/workspace/server.ts`** — Add `writeSnapshot()` call inside `saveWorkflow()`, plus new functions: `listSnapshots()`, `getSnapshot()`, `computeChanges()`.
- **`src/lib/workspace/types.ts`** — Add snapshot and change event type definitions.
- **`src/app/api/workspaces/[id]/workflows/[wid]/route.ts`** — Modify PUT handler to call snapshot writer after save.
- **`src/components/workspace/dashboard.tsx`** — Integrate changes fetch, last-seen read/write, and render the changes panel.
- **`src/hooks/use-workspace.ts`** — Optionally extend or keep separate; the changes fetch may be a dedicated hook.

### Existing Files to Read (Reference Only)
- **`CLAUDE.md`** — Project conventions, import rules (`@/*` alias, `zod/v4`), dark theme, guardrails.
- **`src/lib/workspace/config.ts`** — `getWorkspaceConfig().dataDir` for building snapshot paths.
- **`src/lib/workspace/schemas.ts`** — Zod schema pattern to follow for new schemas.
- **`src/lib/collaboration/awareness-names.ts`** — `getColorForClientId()` and `HUE_SLOTS` for badge colors. Need a name-based variant since changes panel uses display names, not client IDs.
- **`src/lib/theme.ts`** — Theme tokens for consistent styling.
- **`src/components/workspace/workflow-card.tsx`** — Card styling patterns.
- **`src/components/workspace/workspace-header.tsx`** — Header layout pattern.

### New Files
- **`src/app/api/workspaces/[id]/workflows/[wid]/snapshots/route.ts`** — `GET` handler returning snapshot metadata list (FR-4).
- **`src/app/api/workspaces/[id]/workflows/[wid]/snapshots/[timestamp]/route.ts`** — `GET` handler returning full snapshot JSON (FR-5).
- **`src/app/api/workspaces/[id]/changes/route.ts`** — `GET` handler computing and returning diff events (FR-9).
- **`src/components/workspace/changes-panel.tsx`** — The slide-in changes panel UI component (FR-14–FR-20).
- **`src/hooks/use-workspace-changes.ts`** — Hook for fetching changes and managing last-seen state (FR-6–FR-8, FR-21–FR-22).
- **`src/lib/workspace/snapshots.ts`** — Server-side snapshot read/write/diff logic (FR-1–FR-3, FR-10–FR-13).
- **`docs/tasks/feature-workspace-recent-changes-panel-857b7bc9/e2e-feature-workspace-recent-changes-panel-857b7bc9.md`** — E2E test specification.

## Implementation Plan

### Phase 1: Foundation
- Define TypeScript types for snapshots and change events.
- Implement snapshot file read/write utilities in a new `src/lib/workspace/snapshots.ts` module.
- Add snapshot writing to the existing `saveWorkflow()` function in `server.ts`.

### Phase 2: Core Implementation
- Build the diff computation engine that walks adjacent snapshot pairs and detects node_added, node_deleted, node_renamed events.
- Create the three new API routes: snapshot list, snapshot detail, and changes endpoint.
- Create the `useWorkspaceChanges` hook with last-seen localStorage management.

### Phase 3: Integration
- Build the changes panel UI component with slide-in animation, grouped layout, dismiss behavior, and colored initial badges.
- Integrate the changes panel into the dashboard component following the load sequence defined in FR-21.
- Wire up the last-seen timestamp write to occur after both manifest and changes have been fetched and rendered.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Define Snapshot and Change Event Types
- In `src/lib/workspace/types.ts`, add:
  - `SnapshotMeta`: `{ timestamp: string; savedBy: string }`
  - `SnapshotFile`: `{ timestamp: string; workflowId: string; workspaceId: string; savedBy: string; data: WorkflowJSON }`
  - `ChangeEventType`: `"node_added" | "node_deleted" | "node_renamed"`
  - `ChangeEvent`: `{ type: ChangeEventType; nodeName: string; from?: string; to?: string; by: string; at: string }`
  - `WorkflowChanges`: `{ workflowId: string; workflowName: string; changeCount: number; events: ChangeEvent[] }`
  - `ChangesResponse`: `{ changes: WorkflowChanges[] }`

### 2. Implement Snapshot Read/Write Utilities
- Create `src/lib/workspace/snapshots.ts` with:
  - `snapshotsDir(workspaceId, workflowId)` — returns `{dataDir}/{workspaceId}/snapshots/{workflowId}/`
  - `writeSnapshot(workspaceId, workflowId, data: WorkflowJSON, savedBy: string)` — writes `{ timestamp, workflowId, workspaceId, savedBy, data }` to `{snapshotsDir}/{urlSafeTimestamp}.json`. Use atomic write: write to `.tmp` file then `fs.rename()`.
  - `listSnapshots(workspaceId, workflowId)` — reads directory, parses filenames back to timestamps, returns `SnapshotMeta[]` sorted chronologically.
  - `getSnapshot(workspaceId, workflowId, timestamp)` — reads and returns the full `SnapshotFile`.
  - URL-safe encoding: replace colons with dashes in ISO timestamp for filename safety (e.g., `2026-04-10T12-30-00.000Z.json`).

### 3. Hook Snapshot Writing into saveWorkflow
- In `src/lib/workspace/server.ts`, import `writeSnapshot` from `./snapshots`.
- Inside the `saveWorkflow()` function, after writing the workflow JSON and manifest, call `await writeSnapshot(workspaceId, workflowId, data, lastModifiedBy)`.

### 4. Implement Diff Computation Engine
- In `src/lib/workspace/snapshots.ts`, add:
  - `computeChanges(workspaceId, since: string)` that:
    1. Reads the workspace manifest to get all workflow IDs and names.
    2. For each workflow, lists snapshots and filters to those after `since`.
    3. Finds the snapshot immediately before `since` (or treats empty node set as baseline if none exists).
    4. Walks adjacent snapshot pairs chronologically.
    5. For each pair, extracts node sets (by `id`), computes:
       - `node_added`: node ID in newer but not older.
       - `node_deleted`: node ID in older but not newer.
       - `node_renamed`: node ID in both but `data.label` (or node name field) changed.
    6. Each event gets `by` from the later snapshot's `savedBy` and `at` from its timestamp.
    7. Excludes `node_moved` (position-only changes).
    8. Skips workflows with no snapshots after `since` (FR-11).
    9. Returns `ChangesResponse` with `changeCount` as total events per workflow.

### 5. Create Snapshot API Routes
- Create `src/app/api/workspaces/[id]/workflows/[wid]/snapshots/route.ts`:
  - `GET` handler calls `listSnapshots(id, wid)` and returns `SnapshotMeta[]`.
  - Set `export const dynamic = "force-dynamic"`.
- Create `src/app/api/workspaces/[id]/workflows/[wid]/snapshots/[timestamp]/route.ts`:
  - `GET` handler calls `getSnapshot(id, wid, timestamp)`, returns full snapshot or 404.
  - Decode the URL-safe timestamp from the route param.
  - Set `export const dynamic = "force-dynamic"`.

### 6. Create Changes API Route
- Create `src/app/api/workspaces/[id]/changes/route.ts`:
  - `GET` handler reads `since` query parameter.
  - Validates `since` is a valid ISO timestamp; returns 400 if missing/invalid.
  - Calls `computeChanges(id, since)` and returns the result.
  - Set `export const dynamic = "force-dynamic"`.

### 7. Create useWorkspaceChanges Hook
- Create `src/hooks/use-workspace-changes.ts`:
  - Accepts `workspaceId: string` and `isReady: boolean` (gates fetch until manifest is loaded).
  - On mount (when `isReady` is true):
    1. Read `nexus:workspace-last-seen:{workspaceId}` from localStorage → `since`. If absent, default to 24 hours ago.
    2. Fetch `GET /api/workspaces/{workspaceId}/changes?since={since}`.
    3. Store the result in state.
    4. Return `{ changes, isLoading, since, markSeen }`.
  - `markSeen()` writes current UTC timestamp to `nexus:workspace-last-seen:{workspaceId}`.
  - The hook does NOT call `markSeen()` automatically — the dashboard calls it after rendering.

### 8. Build the Changes Panel Component
- Create `src/components/workspace/changes-panel.tsx`:
  - Props: `changes: WorkflowChanges[]`, `since: string`, `onDismiss: () => void`.
  - Panel slides in from the right using a CSS `translate-x` transition (not a modal, does not block the workflow grid).
  - Header: "N changes since {formatted date}" with a "Dismiss" button.
  - Body: Grouped by workflow. Each group has a workflow name header. Under each group, list individual change events.
  - Each event line: colored initial badge (first letter of `by` name, using a name-based hash into the same `HUE_SLOTS` array from `awareness-names.ts`), bold user name, action text ("added Send Notification", "renamed Script 1 -> Validate Input", "deleted Old Transform"), node name.
  - Panel is scrollable if content exceeds viewport height.
  - Create a `getColorForName(name: string)` utility (hash name string to a number, mod by HUE_SLOTS length) — co-locate in the component or in `awareness-names.ts` alongside the existing `getColorForClientId`.

### 9. Integrate Changes Panel into Dashboard
- In `src/components/workspace/dashboard.tsx`:
  - Import and use `useWorkspaceChanges(workspaceId, !isLoading && !!workspace)`.
  - Add `dismissed` state (boolean, default false).
  - After the workspace manifest loads and changes are fetched:
    - If changes are non-empty and not dismissed, render `<ChangesPanel>` alongside the workflow grid (not blocking it).
    - Call `markSeen()` once both workspace data and changes response are available and rendered (FR-6, FR-21 step 6). Use a `useEffect` that depends on workspace and changes being loaded.
  - The panel should not appear during loading state.
  - When dismissed, set `dismissed = true` — panel does not re-appear for this session (page load).

### 10. Create E2E Test Specification
- Create `docs/tasks/feature-workspace-recent-changes-panel-857b7bc9/e2e-feature-workspace-recent-changes-panel-857b7bc9.md` with:
  - **User Story**: Validate that a returning user sees a changes panel on the workspace dashboard showing node-level changes made by other users since their last visit.
  - **Test Steps** (using playwright-cli):
    1. Create a workspace via API `POST /api/workspaces`.
    2. Create a workflow via API `POST /api/workspaces/{id}/workflows`.
    3. Save the workflow with some nodes via `PUT /api/workspaces/{id}/workflows/{wid}` with `lastModifiedBy: "Alice"`.
    4. Wait briefly, then save again with an added node and `lastModifiedBy: "Bob"`.
    5. Set localStorage `nexus:workspace-last-seen:{workspaceId}` to a timestamp before both saves.
    6. Navigate to `/workspace/{id}`.
    7. Assert the changes panel slides in from the right.
    8. Assert the panel header shows "N changes since {date}".
    9. Assert the workflow name appears as a group header.
    10. Assert individual change events show correct user names and node names.
    11. Assert colored initial badges are visible.
    12. Click "Dismiss" — assert panel slides out and is no longer visible.
    13. Reload the page — assert panel re-appears (last-seen was written on prior load, but changes still exist since before that).
    14. Screenshot capture at: panel visible state, after dismiss.
  - **Success Criteria**: Panel appears with correct change data, dismiss works, colors match awareness system hashing.
  - **No-changes scenario**: Set last-seen to current time, reload — assert no panel appears.

### 11. Run Validation Commands
- `bun run typecheck` — ensure zero type errors.
- `bun run lint` — ensure zero lint errors.
- `bun run build` — ensure successful production build.

## Testing Strategy

### Unit Tests
- `src/lib/workspace/__tests__/snapshots.test.ts`:
  - Test `writeSnapshot` creates correct file with correct structure.
  - Test `listSnapshots` returns sorted metadata.
  - Test `getSnapshot` returns full data.
  - Test `computeChanges` with various scenarios: no snapshots, single snapshot, multiple snapshots with adds/deletes/renames.
  - Test node identity by `id` — position-only changes produce no events.
  - Test `since` filtering — only snapshots after `since` are considered.
  - Test baseline snapshot selection (immediately before `since`).

### Edge Cases
- Workflow with no snapshots after `since` — excluded from response.
- No prior snapshot before `since` — baseline is empty node set (all nodes in first snapshot after `since` are `node_added`).
- Same node added then deleted across multiple snapshots — both events recorded (no deduplication per FR-12).
- First-time visitor (no localStorage key) — `since` defaults to 24 hours ago.
- Empty workspace (no workflows) — changes response is `{ changes: [] }`, panel not shown.
- Very long node names or many changes — panel must scroll.
- Concurrent saves — snapshot filenames are timestamped to millisecond; extremely unlikely collision.
- URL-safe timestamp encoding/decoding round-trips correctly.

## Acceptance Criteria
- [ ] AC-1: Opening a workspace after another user has saved changes shows the changes panel with their display name and the affected node names.
- [ ] AC-2: Opening a workspace with no changes since last visit shows no changes panel.
- [ ] AC-3: Dismissing the changes panel hides it for the rest of the session; it re-appears on the next page load if changes still exist.
- [ ] AC-4: The last-seen timestamp updates after each dashboard load, so subsequent visits show only newer changes.
- [ ] AC-5: Node additions, deletions, and renames are all correctly detected and attributed.
- [ ] AC-6: `node_moved`-only saves do not produce change events in the panel.
- [ ] AC-7: `GET /api/workspaces/[id]/changes?since=...` returns a correctly structured response matching the schema in FR-9.
- [ ] AC-8: Each change event in the panel shows a colored initial badge using the same color hashing as the awareness system.
- [ ] AC-9: `bun run typecheck` and `bun run build` pass with no new errors.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

```bash
bun run typecheck
bun run lint
bun run build
```

## Notes
- The snapshot path structure is `{dataDir}/{workspaceId}/snapshots/{workflowId}/{timestamp}.json` — nested under the workspace data directory alongside the existing `workflows/` directory.
- The `savedBy` field comes from the PUT request body's `lastModifiedBy` field, which is populated from `nexus:collab-name` localStorage on the client.
- For the name-based color hash, use a simple string hash (e.g., sum of char codes) modulo 8 into the same `HUE_SLOTS` array. This gives visual consistency: the same display name always gets the same color badge, matching what they'd see in the awareness/collaboration UI.
- Atomic snapshot writes (write to `.tmp` then rename) prevent partial reads during concurrent diff computation.
- The changes panel does not block the workflow grid — it is rendered alongside it (e.g., as an absolutely positioned or flex-adjacent panel on the right).
- Retention/pruning of old snapshots is explicitly out of scope for this feature.

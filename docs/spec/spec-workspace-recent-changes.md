# Workspace Recent Changes

## Metadata
date: `2026-04-10`

## Overview
This spec covers the "what changed since your last visit" feature for Nexus Workflow Studio workspaces — similar to Miro's change notification panel. It defines periodic workflow snapshots, node-level diff computation, per-browser last-seen tracking, and the dashboard panel that presents changes on workspace open.

## Problem Statement
When a team member returns to a workspace after time away, they have no visibility into what changed while they were gone. This spec adds a lightweight audit trail via periodic server snapshots and a dashboard-side diff panel that surfaces workflow-level summaries (who edited, when) and expandable node-level changes (added, removed, renamed nodes) since the user's last visit.

## User Stories
- As a returning team member, I want to see what changed in the workspace since I last opened it, so I can quickly get up to speed without manually reviewing every workflow.
- As a team member, I want to know who made each change so I can follow up with the right person.
- As a user, I want to dismiss the changes panel once I've reviewed it, so it doesn't distract me while I work.

## Functional Requirements

### Snapshot System (Server)
- [ ] FR-1: The server takes a timestamped snapshot of a workflow's full `WorkflowJSON` whenever the workflow is saved via `PUT /api/workspaces/[id]/workflows/[wid]`. The snapshot is written to `/data/workspaces/{workspaceId}/snapshots/{workflowId}/{timestamp}.json`. The timestamp is an ISO 8601 string used as the filename (URL-safe encoded).
- [ ] FR-2: Each snapshot file contains: `{ timestamp, workflowId, workspaceId, savedBy: string, data: WorkflowJSON }`. `savedBy` is the display name passed in the PUT request body.
- [ ] FR-3: Snapshots are append-only. No snapshot is overwritten or deleted by the system for MVP. (Retention policy is future work.)
- [ ] FR-4: A new API endpoint `GET /api/workspaces/[id]/workflows/[wid]/snapshots` returns a list of snapshot metadata (timestamp, savedBy) without full data — used to enumerate snapshots for diff queries.
- [ ] FR-5: A new API endpoint `GET /api/workspaces/[id]/workflows/[wid]/snapshots/[timestamp]` returns the full snapshot JSON for a specific timestamp.

### Last-Seen Tracking (Client)
- [ ] FR-6: When a user opens a workspace dashboard, the current UTC timestamp is written to localStorage under the key `nexus:workspace-last-seen:{workspaceId}` only after both the workspace manifest and the changes response have been received and rendered (step 6 in FR-21). If the user navigates away before those responses arrive, the timestamp is not written, and the same changes will surface again on the next visit. This is intentional conservative behavior — it is better to show changes twice than to miss them.
- [ ] FR-7: On subsequent opens, the previous value of `nexus:workspace-last-seen:{workspaceId}` is read before being overwritten, and used as the `since` baseline for the diff query.
- [ ] FR-8: If no last-seen value exists (first visit), the `since` baseline is set to 24 hours ago as a default window.

### Diff Computation
- [ ] FR-9: A new API endpoint `GET /api/workspaces/[id]/changes?since={isoTimestamp}` returns a changes summary for all workflows in the workspace modified after `since`. Response shape:
  ```json
  {
    "changes": [
      {
        "workflowId": "...",
        "workflowName": "...",
        "changeCount": 3,
        "events": [
          { "type": "node_added", "nodeName": "Send Notification", "by": "Bob", "at": "..." },
          { "type": "node_renamed", "from": "Script 1", "to": "Validate Input", "by": "Alice", "at": "..." },
          { "type": "node_deleted", "nodeName": "Old Transform", "by": "Carol", "at": "..." }
        ]
      }
    ]
  }
  ```
- [ ] FR-10: Diff logic uses a sequential walk: starting from the snapshot immediately before `since` (or the workflow's initial state if no prior snapshot exists), it walks forward through every snapshot after `since` in chronological order, comparing adjacent snapshot pairs. For each adjacent pair, the node sets are diffed. Change types are: `node_added`, `node_deleted`, `node_renamed` (label or name changed). `node_moved` (position-only changes) is excluded. Node identity is determined by node `id`.
- [ ] FR-11: If a workflow has no snapshots after `since`, it is excluded from the response.
- [ ] FR-12: The `by` field in each event is taken from the `savedBy` field of the snapshot in which the change first appeared (i.e., the later snapshot of the adjacent pair that introduced the change). If the same node is added and then deleted across multiple snapshots, each event is recorded separately with its respective `savedBy`. Deduplication (e.g., add + delete of same node) is not performed for MVP.
- [ ] FR-13: `changeCount` is the total number of distinct node-level events across all snapshots in the window, not the number of snapshots.

### Changes Panel (Dashboard UI)
- [ ] FR-14: On workspace dashboard load, if the `since` query returns any changes, the changes panel slides in from the right side of the dashboard automatically.
- [ ] FR-15: The panel header shows: "N changes since {formatted date}" where N is the total `changeCount` across all workflows, and the date is the formatted `since` timestamp (e.g., "Apr 8").
- [ ] FR-16: Changes are grouped by workflow. Each workflow group shows the workflow name as a section header and lists individual node-level events below it.
- [ ] FR-17: Each change event shows: user display name (bold), action description (e.g., "added a node", "renamed a node", "deleted a node"), and the node name(s) involved. Example: "Bob added Send Notification", "Alice renamed Script 1 → Validate Input".
- [ ] FR-18: A "Dismiss" button in the panel header hides the panel. Dismissing does NOT update the last-seen timestamp — it simply hides the panel for this session. The panel will not re-appear on the same dashboard load once dismissed.
- [ ] FR-19: If there are no changes since last visit, the panel does not appear. No empty-state version of the panel is shown.
- [ ] FR-20: The panel is scrollable if the change list exceeds the viewport height.

### Integration with Dashboard Load Sequence
- [ ] FR-21: The dashboard load sequence is:
  1. Read `nexus:workspace-last-seen:{workspaceId}` from localStorage → `since` value.
  2. Fetch workspace manifest (`GET /api/workspaces/[id]`).
  3. Fetch changes since `since` (`GET /api/workspaces/[id]/changes?since=...`).
  4. Render dashboard + workflow cards.
  5. If changes response is non-empty, render and slide in the changes panel.
  6. Write current timestamp to `nexus:workspace-last-seen:{workspaceId}`.
- [ ] FR-22: Steps 2 and 3 are fetched in parallel to minimize load time.

## UI/UX Requirements

### Mockup Reference
Playground: `/tmp/nexus-workspaces-playground.html` — Screen 2 (Workspace Dashboard), changes panel on right side (approved 2026-04-10).

### Screens
1. **Workspace dashboard with changes panel** — Panel slides in from the right on load. Header: "N changes since {date}". Grouped by workflow. Node-level change items with colored user initial badge.

### User Flows
1. User was last in the workspace on April 8 → returns April 10 → dashboard loads → changes query runs with `since=2026-04-08T...` → 3 changes found → panel slides in showing grouped changes → user reads them → clicks "Dismiss" → panel collapses → user opens a workflow.
2. User opens workspace with no changes since last visit → panel never appears → dashboard shows normally.
3. First-time visitor (no last-seen) → `since` defaults to 24 hours ago → if any recent activity, panel appears → otherwise no panel.

### States
- **Loading**: Panel does not appear during load. Workflow cards render first; panel slides in only after the changes API responds.
- **Empty (no changes)**: Panel is not rendered at all.
- **Panel visible**: Slides in with a CSS transition (width expansion or translate). Not a modal — does not block the workflow grid.
- **Panel dismissed**: Slides out, not rendered for remainder of session.

## Decisions

### Business Decisions
- BD-1/BD-2/BD-5: Workspace access, multi-workflow model, and standalone editor preservation — owned by spec-workspace-foundation.md (decision numbers defined there).
- BD-3: Changes panel shows both workflow-level summary and expandable node-level events (added, removed, renamed). `node_moved` is excluded — only structural changes surface.
- BD-4: Per-browser last-seen timestamp in localStorage. Each device/browser maintains its own baseline. No server-side "seen" tracking.
- BD-6: Changes attributed to the display name stored in the snapshot's `savedBy` field (from `nexus:collab-name`). Falls back to "Unknown" if not set at save time.

### Architecture Decisions

#### AD-3: Snapshot-per-save (triggered by PUT workflow save)
- **Options considered:**
  - A: Timer-based snapshots on the server — complex, requires background job.
  - B: Snapshot on every PUT save — simple, piggybacks on existing save mechanism, sufficient for 2–10 user scale.
  - C: Append-only event log per change — most accurate but complex to implement.
- **Decision:** Option B. A snapshot is written whenever `PUT /api/workspaces/[id]/workflows/[wid]` is called. Given the 30-second auto-save interval from spec-workspace-foundation, this produces granular-enough history for node-level diffs.

#### AD-4: Server-side diff computation
- **Options considered:**
  - A: Client-side diff — requires sending full snapshot JSON to the browser; wasteful for large workflows.
  - B: Server-side diff — server fetches two snapshots, computes node set delta, returns structured events. Only the summary crosses the wire.
- **Decision:** Option B. `GET /api/workspaces/[id]/changes?since=...` computes and returns structured events. Client receives only the rendered change list.

### Design Decisions
- DD-2: Panel auto-appears on load (not a persistent column, not a bell icon). Dismissed per session only — will re-appear on next page load if it hasn't been seen.
- DD-5: Change items show a colored initial badge using the same color-per-name hashing used by the existing awareness system (`getColorForClientId` or equivalent) so the badge color is consistent with the user's presence avatar.

### Infrastructure Decisions
- ID-3: Snapshot files are stored as flat JSON files per workflow per timestamp. No indexing needed at MVP scale (dozens of workflows, small team). If snapshot count grows large, a future cleanup job can prune by age.
- ID-4: The `/changes` endpoint reads snapshot file lists and computes diffs synchronously on each request. At target scale (dozens of workflows, small team) this is acceptable. No caching layer for MVP.

## Non-Functional Requirements
- Performance: The `/changes` endpoint should respond within 500ms for a workspace with up to 20 workflows and 100 snapshots each, on localhost.
- Storage: Each snapshot is a copy of the WorkflowJSON. Estimate ~50–200 KB per snapshot. At 30-second auto-save intervals with 2–10 users, budget for ~100 snapshots/workflow/day. A retention policy (e.g., keep last 100 per workflow) should be noted as near-term follow-up.

## Out of Scope
- Retention/pruning of old snapshots — noted as near-term follow-up.
- Per-user server-side "seen" tracking (would require stable user identity).
- `node_moved` events — position changes excluded; only structural changes surface.
- Change history timeline / version restore — that is Brain-style versioning; not in this spec.
- Real-time push notification of changes while dashboard is open — the panel reflects state at load time only.
- Edge-level diff (added/removed connections) — node-only for MVP.

## Do's and Don'ts

### Do
- Write snapshot files atomically (write to `.tmp` then rename) to avoid partial reads during diff computation.
- Use the node `id` field (not `label` or `name`) as the stable identity for node-level diffing.
- Parallelize the manifest fetch and changes fetch on the dashboard to minimize perceived load time.
- Use the same color hashing as the awareness system for change attribution badges so colors are visually consistent.

### Don't
- Don't show the changes panel if the changes response is empty — avoid a confusing empty-state panel.
- Don't overwrite last-seen timestamp until after the dashboard is rendered and changes are fetched — avoids a race where the new timestamp is written before the diff runs.
- Don't block dashboard rendering on the changes fetch — show the workflow grid first, slide in the panel when the changes response arrives.
- Don't compute diffs on the client by downloading full snapshot JSON — keep that on the server.

## Acceptance Criteria
- [ ] AC-1: Opening a workspace after another user has saved changes shows the changes panel with their display name and the affected node names.
- [ ] AC-2: Opening a workspace with no changes since last visit shows no changes panel.
- [ ] AC-3: Dismissing the changes panel hides it for the rest of the session; it re-appears on the next page load if changes still exist.
- [ ] AC-4: The last-seen timestamp updates after each dashboard load, so subsequent visits show only newer changes.
- [ ] AC-5: Node additions, deletions, and renames are all correctly detected and attributed.
- [ ] AC-6: `node_moved`-only saves do not produce change events in the panel.
- [ ] AC-7: `GET /api/workspaces/[id]/changes?since=...` returns a correctly structured response matching the schema in FR-9.
- [ ] AC-8: Each change event in the panel shows a colored initial badge using the same color hashing as the awareness system (consistent with peer presence avatars).
- [ ] AC-9: `bun run typecheck` and `bun run build` pass with no new errors.

## Dependencies
- spec-workspace-foundation.md must be implemented first — this spec requires the workspace persistence layer, `PUT /api/workspaces/[id]/workflows/[wid]` endpoint, and the dashboard UI shell.
- The `savedBy` field must be populated in PUT save requests (established in spec-workspace-foundation FR-15).

## Related Specs
- **Spec 1 (workspace-foundation):** Prerequisite. Provides workspace persistence, save API, and dashboard UI into which the changes panel is integrated.

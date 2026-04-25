# Workspace Foundation

## Metadata
date: `2026-04-10`

## Overview
This spec covers the core workspace system for Nexus Workflow Studio: server-side workspace and workflow persistence, a new landing page, a workspace dashboard, multi-user real-time editing wired per workflow, and invite-link sharing. It is a prerequisite for spec-workspace-recent-changes.md.

## Problem Statement
Workflows currently persist only in browser localStorage and cannot be shared or co-edited across devices or users. This spec introduces a workspace model that allows teams of 2–10 people to create shared environments containing multiple workflows, access them from any device via invite link, and edit them simultaneously with the existing Y.js/WebRTC collaboration infrastructure.

## User Stories
- As a user, I want to create a workspace and share a link so my teammates can join and edit workflows together.
- As a user, I want a dashboard showing all workflows in my workspace so I can navigate and manage them in one place.
- As a user, I want to continue using the standalone editor without joining a workspace, so existing solo workflows are unaffected.
- As a team member, I want to see who else is currently in the workspace so I know who I might be editing alongside.

## Functional Requirements

### Landing Page (`/`)
- [ ] FR-1: The root route `/` is replaced with a workspace landing page. The existing standalone editor is accessible via a separate "Open Editor" path from the landing page.
- [ ] FR-2: Landing page shows two CTA cards: "Open Editor" (navigates to the existing `/editor` or equivalent standalone route) and "Open Workspace" (opens a create/join flow).
- [ ] FR-3: Landing page shows a "Recent workspaces" list populated from localStorage. Each entry shows: workspace name, last-accessed time, workflow count, and up to 3 member initial badges. The member initials are stored in the localStorage record at the time of last visit (a snapshot of who was present, not live presence) and may not reflect current active members.
- [ ] FR-4: A "New workspace" button creates a workspace via `POST /api/workspaces` and navigates to `/workspace/[id]`.
- [ ] FR-5: Visiting a workspace URL directly (via shared link) navigates to the workspace dashboard without requiring any additional steps.

### Workspace Data Model (Server)
- [ ] FR-6: A workspace record contains: `id` (nanoid, 21 chars), `name` (string, 1–100 chars), `createdAt` (ISO timestamp), `updatedAt` (ISO timestamp).
- [ ] FR-7: A workflow record within a workspace contains: `id` (nanoid), `workspaceId`, `name` (string), `createdAt`, `updatedAt`, `lastModifiedBy` (display name string), and `data` (WorkflowJSON — same shape as the existing standalone export format).
- [ ] FR-8: Workspace and workflow data are persisted to the server filesystem under `NEXUS_BRAIN_DATA_DIR` (e.g., `/data/workspaces/{workspaceId}/manifest.json` and `/data/workspaces/{workspaceId}/workflows/{workflowId}.json`). This mirrors the Brain file-store pattern.
- [ ] FR-9: A workspace manifest file tracks the workspace record and a list of workflow IDs + metadata. Full workflow JSON is stored per-workflow file, not inlined into the manifest.

### API Routes
- [ ] FR-10: `POST /api/workspaces` — creates a new workspace; returns `{ id, name, createdAt }`.
- [ ] FR-11: `GET /api/workspaces/[id]` — returns workspace manifest + workflow metadata list (no full workflow data).
- [ ] FR-12: `PATCH /api/workspaces/[id]` — updates workspace name.
- [ ] FR-13: `POST /api/workspaces/[id]/workflows` — creates a new empty workflow; returns `{ id, name, createdAt }`.
- [ ] FR-14: `GET /api/workspaces/[id]/workflows/[wid]` — returns full WorkflowJSON for a workflow.
- [ ] FR-15: `PUT /api/workspaces/[id]/workflows/[wid]` — saves (replaces) a workflow's full JSON. Accepts `{ data: WorkflowJSON, lastModifiedBy: string }`. Updates `updatedAt` and `lastModifiedBy` on the workflow record.
- [ ] FR-16: `PATCH /api/workspaces/[id]/workflows/[wid]` — updates workflow metadata only (e.g., name rename).
- [ ] FR-17: `DELETE /api/workspaces/[id]/workflows/[wid]` — deletes a workflow (hard delete for MVP).

### Workspace Dashboard (`/workspace/[id]`)
- [ ] FR-18: Dashboard fetches workspace data from `GET /api/workspaces/[id]` on load.
- [ ] FR-19: Dashboard displays workflow cards in a grid. Each card shows: workflow name, last-modified timestamp, last-modified-by display name, an "Open" button, and a live-editing indicator (green dot) if any peers are currently in that workflow's Y.js room.
- [ ] FR-20: Dashboard shows a "New Workflow" card (dashed border). Clicking it calls `POST /api/workspaces/[id]/workflows` and navigates to the new workflow in the editor.
- [ ] FR-21: Workflow cards support rename (inline edit on double-click or via a context action). Rename calls `PATCH /api/workspaces/[id]/workflows/[wid]`.
- [ ] FR-22: Workspace name in the top bar is an editable inline input. Saving calls `PATCH /api/workspaces/[id]`.
- [ ] FR-23: Dashboard shows member presence avatars (colored initials) for peers currently on the dashboard, using the existing awareness system.
- [ ] FR-24: A "Share" button copies the current workspace URL to the clipboard and shows a brief toast confirmation.

### Real-Time Collaboration Per Workflow
- [ ] FR-25: Each workflow in a workspace gets a stable Y.js room ID derived deterministically from `workspaceId` and `workflowId` (e.g., `nexus-ws-{workspaceId}-{workflowId}`). This replaces the ad-hoc `?room=` query param for workspace workflows.
- [ ] FR-26: When a user opens a workflow from the dashboard, the editor loads the workflow data from the server (`GET /api/workspaces/[id]/workflows/[wid]`) and then starts the Y.js/WebRTC provider on the derived room ID. Reuses existing `CollabDoc` + `collab-store` infrastructure.
- [ ] FR-27: On Y.js sync (peer join), peers adopt the incoming Y.js state as the authoritative source (same as existing collab behavior).
- [ ] FR-28: Periodic auto-save to server: the editor debounces local changes and calls `PUT /api/workspaces/[id]/workflows/[wid]` with the current WorkflowJSON and the user's display name 30 seconds after the last local change — regardless of whether other peers are present. In multi-user sessions, the Y.js CRDT ensures the saved state reflects all concurrent edits that arrived before the debounce fires. (Snapshot-driven save for the recent-changes system is specified in spec-workspace-recent-changes.md.)
- [ ] FR-29: On editor unload (page close / navigation back to dashboard), a best-effort `PUT` save is attempted using `navigator.sendBeacon` or `beforeunload`.

### Editor Top Bar (Workspace Context)
- [ ] FR-30: When editing a workspace workflow, the editor top bar shows a breadcrumb "← {workspace name}" that navigates back to the dashboard.
- [ ] FR-31: The workflow name in the top bar reflects the workspace workflow name (not a local rename). Renaming in the editor calls `PATCH /api/workspaces/[id]/workflows/[wid]`.
- [ ] FR-32: Member presence avatars in the editor top bar show peers connected to this specific workflow's Y.js room (existing awareness behavior, scoped to the room).

### Routing
- [ ] FR-33: New routes added: `/workspace/[id]` (dashboard) and `/workspace/[id]/workflow/[wid]` (editor). The existing `/` editor route is preserved at a new path (e.g., `/editor`) and redirected from the landing page's "Open Editor" CTA.

### Local Workspace History
- [ ] FR-34: When a user visits a workspace, the workspace ID, name, workflow count, and a snapshot of up to 3 current member names (from the awareness system) are stored in localStorage (`nexus:recent-workspaces`, max 10 entries, most-recent-first) so the landing page can show recent workspaces without a server call. The member snapshot reflects who was present at time of visit.

## UI/UX Requirements

### Mockup Reference
Playground: `/tmp/nexus-workspaces-playground.html` (approved 2026-04-10)

### Screens
1. **Landing page (`/`)** — Two CTA cards (Open Editor, Open Workspace), recent workspaces list with member presence avatars, "New workspace" button.
2. **Workspace dashboard (`/workspace/[id]`)** — Editable workspace name in top bar, member presence avatars, Share button; workflow card grid with live-editing dots; "New Workflow" dashed card.
3. **Editor (`/workspace/[id]/workflow/[wid]`)** — Existing canvas UI with workspace breadcrumb ← in top bar, workflow name, presence avatars, Share button.

### User Flows
1. User visits `/` → clicks "New workspace" → workspace created → redirected to `/workspace/[id]` dashboard.
2. User shares `/workspace/[id]` URL → teammate opens it → lands on dashboard → sees all workflows → clicks "Open" on a workflow → enters editor → Y.js room starts → real-time sync begins.
3. Dashboard loads with no workflows → empty state: illustration + "Create your first workflow" button.
4. User renames workspace → inline input saves on blur or Enter.
5. User clicks "Open Editor" → navigated to `/editor` (standalone mode, no workspace).

### States
- **Dashboard loading**: Skeleton cards while fetching workspace manifest.
- **Dashboard empty**: Empty state with call to action to create first workflow.
- **Workflow card — live**: Green dot + "● live" label when peers are in the room.
- **Workflow card — error**: Show error toast if delete or rename fails.

## Decisions

### Business Decisions
- BD-1: No authentication required. Access is invite-link only — anyone with the workspace URL can join and edit. No approval step, no permission tiers for MVP.
- BD-2: A workspace contains multiple workflows. Users create, rename, and delete individual workflows within a workspace.
- BD-3/BD-4: Recent-changes panel behavior and per-browser last-seen tracking — owned by spec-workspace-recent-changes.md (decision numbers reserved there).
- BD-5: The standalone editor (`/editor`) is preserved as-is. Workspaces are opt-in. The landing page offers both paths.
- BD-6: Change attribution via display name — owned by spec-workspace-recent-changes.md (decision number reserved there).

### Architecture Decisions

#### AD-1: Server-side file persistence (mirrors Brain)
- **Options considered:**
  - A: Extend Brain's file store — same pattern, same volume mount, same tech. Low risk, consistent.
  - B: New database (SQLite, etc.) — more queryable but introduces new dependency and migration complexity.
  - C: localStorage only — no cross-device/cross-user capability.
- **Decision:** Option A. Workspace data lives under `NEXUS_BRAIN_DATA_DIR/workspaces/`. No new dependencies.

#### AD-2: Y.js WebRTC per workflow with stable room ID
- **Options considered:**
  - A: Derive room ID from workspaceId + workflowId (stable, no URL params needed).
  - B: Keep ad-hoc `?room=` param (fragile for workspace context — room IDs would need to be stored separately).
  - C: Server-authoritative WebSocket sync (more reliable through NAT but requires new server infra).
- **Decision:** Option A. Room ID = `nexus-ws-{workspaceId}-{workflowId}`. Reuses existing `CollabDoc` with no structural changes.

### Design Decisions
- DD-1: `/workspace/[id]` is a new Next.js App Router page (not a panel inside the editor). Keeps dashboard and editor concerns separate.
- DD-2: Recent-changes panel placement and appearance behavior — owned by spec-workspace-recent-changes.md (decision number reserved there).
- DD-3: `/` becomes the workspace landing page. The standalone editor moves to `/editor`.
- DD-4: Share = copy URL to clipboard. No modal, no permissions UI.

### Infrastructure Decisions
- ID-1: Target scale is 2–10 concurrent users, dozens of workflows per workspace. No caching layer or horizontal scaling needed for MVP.
- ID-2: File-based persistence uses synchronous reads/writes via existing Brain pattern. For MVP, no locking beyond what Next.js API route serialization provides.

## Non-Functional Requirements
- Performance: Dashboard should load within 300ms on localhost (manifest is small JSON, no full workflow data fetched on list).
- Security: No sensitive data beyond workflow content. No auth tokens needed (invite-link model). Workspace IDs are unguessable nanoids (21 chars, ~126 bits entropy).
- Accessibility: Workspace name input, workflow card buttons, and presence avatars must have appropriate ARIA labels. Focus management on navigation.

## Out of Scope
- User accounts, login, or email-based identity — deferred to future work.
- Read-only / view-only share links — all link recipients get edit access.
- Workspace-level JSON export (zip of all workflows) — individual workflow export only.
- Workflow deletion confirmation dialog — hard delete for MVP.
- Workspace deletion — deferred.
- Offline support / conflict resolution beyond Y.js CRDT — not needed at target scale.
- Recent changes panel — covered in spec-workspace-recent-changes.md.

## Do's and Don'ts

### Do
- Mirror the Brain API handler pattern (`src/app/api/brain/`) for new workspace routes.
- Reuse `WorkflowJSON` as the wire format for workflow save/load (same as standalone export).
- Derive Y.js room IDs deterministically — never store them separately.
- Store only workspace ID + name in `nexus:recent-workspaces` localStorage; fetch fresh data from the server on dashboard load.
- Reuse existing `collab-store`, `awareness-store`, and `CollabDoc` without modification where possible.

### Don't
- Don't load full WorkflowJSON for all workflows on the dashboard — only fetch metadata in the manifest.
- Don't inline workflow data into the workspace manifest file — keep manifest as a lightweight index.
- Don't break the standalone editor (`/editor`) — it must continue working independently of the workspace system.
- Don't add auth middleware — this is an invite-link-only system for MVP.

## Acceptance Criteria
- [ ] AC-1: User can create a workspace from the landing page; workspace persists to the server and survives app restart.
- [ ] AC-2: Sharing the workspace URL with another browser opens the same dashboard with the same workflow list.
- [ ] AC-3: Two users opening the same workflow in the same workspace see each other's edits in real time (Y.js sync works).
- [ ] AC-4: Dashboard shows a green live-editing dot on a workflow card when a peer is in that workflow's Y.js room.
- [ ] AC-5: Navigating back from the editor to the dashboard with the breadcrumb returns to the correct workspace.
- [ ] AC-6: Standalone editor at `/editor` continues to function exactly as before, with no workspace dependency.
- [ ] AC-7: Recent workspaces appear on the landing page after visiting a workspace (localStorage-backed).
- [ ] AC-8: Workflow cards show correct last-modified time and author name after a save.
- [ ] AC-9: `bun run typecheck` and `bun run build` pass with no new errors.

## Dependencies
- Brain file-store pattern must be understood before implementing workspace persistence (`src/lib/brain/server.ts`, `src/app/api/brain/`).
- Existing Y.js collaboration must remain functional — do not refactor `src/lib/collaboration/collab-doc.ts` without verifying collab tests pass.
- `NEXUS_BRAIN_DATA_DIR` environment variable and Docker volume mount must be configured (already set up in `docker-compose.yml`).

## Related Specs
- **Spec 2 (workspace-recent-changes):** Builds on top of this spec. Requires workspace and workflow persistence, the dashboard UI, and the `lastModifiedBy` + `updatedAt` fields established here.

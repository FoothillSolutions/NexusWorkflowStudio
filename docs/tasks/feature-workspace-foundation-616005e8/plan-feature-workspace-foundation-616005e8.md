# feature: Workspace Foundation

## Metadata
adw_id: `616005e8`
issue_description: `Workspace Foundation — server-side workspace/workflow persistence, landing page, workspace dashboard, per-workflow Y.js collaboration, invite-link sharing`

## Description
Nexus Workflow Studio currently persists workflows only in browser localStorage. This feature introduces a workspace model that allows teams of 2–10 people to create shared environments containing multiple workflows, access them from any device via an invite link, and edit them simultaneously using the existing Y.js/WebRTC collaboration infrastructure. The work includes: server-side file persistence for workspaces and workflows (mirroring the Brain file-store pattern), a new landing page at `/`, a workspace dashboard at `/workspace/[id]`, per-workflow real-time collaboration with stable Y.js room IDs, auto-save to server, and invite-link sharing via URL copy.

## Objective
When complete, users can create workspaces, add multiple workflows within them, share the workspace URL with teammates, and collaboratively edit individual workflows in real time — all persisted server-side so data survives across devices and browser sessions. The existing standalone editor remains fully functional at `/editor`.

## Problem Statement
Workflows are browser-local only. There is no way to share, co-edit across devices, or organize workflows into team-scoped collections. The existing collaboration system requires manually sharing ad-hoc room URLs and has no server persistence — if all peers leave, the workflow data relies on Hocuspocus disk state only.

## Solution Statement
Introduce a workspace abstraction backed by server-side file persistence (mirroring Brain's manifest pattern under `NEXUS_BRAIN_DATA_DIR/workspaces/`). Add Next.js App Router pages for a landing page (`/`), workspace dashboard (`/workspace/[id]`), and workspace-scoped editor (`/workspace/[id]/workflow/[wid]`). Derive stable Y.js room IDs from workspace+workflow IDs. Auto-save workflow state to the server on a 30-second debounce. Move the existing standalone editor to `/editor`.

## Code Patterns to Follow
Reference implementations:
- **Brain file-store pattern** (`src/lib/brain/server.ts`, `src/lib/brain/types.ts`, `src/lib/brain/config.ts`): Manifest-based JSON persistence with `ensureDir`, `readJsonFile`, `writeJsonFile`, nanoid IDs, `nowIso()` timestamps. Mirror this for workspace/workflow storage.
- **Brain API routes** (`src/app/api/brain/session/route.ts`, `src/app/api/brain/documents/route.ts`, `src/app/api/brain/documents/[id]/route.ts`): Next.js Route Handler pattern with `NextRequest`/`NextResponse`, JSON body parsing, error handling returning `{ error }` responses.
- **Collaboration infrastructure** (`src/lib/collaboration/collab-doc.ts`, `src/lib/collaboration/config.ts`, `src/store/collaboration/collab-store.ts`, `src/store/collaboration/awareness-store.ts`): Y.js + HocuspocusProvider, room ID management, awareness state, bidirectional Zustand↔Y.js sync.
- **Header/TopBar** (`src/components/workflow/header.tsx`): Component composition pattern with sub-components in `header/` subdirectory.
- **Docker compose** (`docker-compose.yml`): Volume mount pattern for `NEXUS_BRAIN_DATA_DIR`.

## Relevant Files
Use these files to complete the task:

- **`CLAUDE.md`** — Project coding rules and conventions. The implementer MUST follow these rules during implementation.
- **`docs/tasks/conditional_docs.md`** — Lists conditional documentation. This task touches Brain-adjacent persistence, so read `docs/tasks/persistent-brain/doc-persistent-brain.md` for reference.
- **`docs/tasks/persistent-brain/doc-persistent-brain.md`** — Detailed reference for the Brain file-store pattern, API routes, token signing, and Hocuspocus integration. Mirror this pattern for workspace persistence.
- **`src/lib/brain/server.ts`** — Brain server-side persistence: manifest read/write, nanoid generation, ensureDir, readJsonFile/writeJsonFile patterns. Template for workspace server module.
- **`src/lib/brain/types.ts`** — Brain manifest and record types. Template for workspace types.
- **`src/lib/brain/config.ts`** — Config module pattern with env variable fallbacks. Template for workspace config.
- **`src/lib/brain/schemas.ts`** — Zod validation schemas for Brain. Template for workspace API validation.
- **`src/app/api/brain/session/route.ts`** — Brain session API route. Pattern for workspace API route handlers.
- **`src/app/api/brain/documents/route.ts`** — Brain documents list/create API. Pattern for workflow CRUD routes.
- **`src/app/api/brain/documents/[id]/route.ts`** — Brain document delete by ID. Pattern for dynamic route params.
- **`src/types/workflow.ts`** — `WorkflowJSON` type definition. The wire format for workflow save/load.
- **`src/lib/collaboration/collab-doc.ts`** — Y.js CollabDoc coordinator. Will need workspace-aware room ID support.
- **`src/lib/collaboration/config.ts`** — Room URL builders (`buildCollabRoomUrl`, `buildCollabShareUrl`). Needs workspace-aware variants.
- **`src/store/collaboration/collab-store.ts`** — Collab Zustand store. Needs workspace context fields.
- **`src/store/collaboration/awareness-store.ts`** — Awareness peer tracking. Used for dashboard presence.
- **`src/components/workflow/header.tsx`** — Editor header. Needs workspace breadcrumb and workspace-aware name/share behavior.
- **`src/components/workflow/header/workflow-name-card.tsx`** — Workflow name display/edit. Needs workspace-aware rename.
- **`src/components/workflow/header/use-header-controller.ts`** — Header state controller. Needs workspace context.
- **`src/components/workflow/collaboration/share-button.tsx`** — Share button. Needs workspace-aware URL generation.
- **`src/components/workflow/collaboration/presence-avatars.tsx`** — Presence avatars. Reused on dashboard.
- **`src/components/workflow/workflow-editor.tsx`** — Main editor component. Needs workspace-aware loading and auto-save.
- **`src/app/page.tsx`** — Current root route (renders WorkflowEditor). Will become landing page.
- **`src/app/layout.tsx`** — Root layout. May need minor adjustments.
- **`docker-compose.yml`** — Docker Compose config. Workspace data reuses existing `NEXUS_BRAIN_DATA_DIR` volume.

### New Files
- `src/lib/workspace/types.ts` — Workspace and workflow record types, manifest type
- `src/lib/workspace/config.ts` — Workspace config (data dir, env vars)
- `src/lib/workspace/server.ts` — Server-side workspace/workflow CRUD operations
- `src/lib/workspace/schemas.ts` — Zod validation schemas for workspace API inputs
- `src/app/api/workspaces/route.ts` — `POST /api/workspaces` (create workspace)
- `src/app/api/workspaces/[id]/route.ts` — `GET`, `PATCH /api/workspaces/[id]`
- `src/app/api/workspaces/[id]/workflows/route.ts` — `POST /api/workspaces/[id]/workflows` (create workflow)
- `src/app/api/workspaces/[id]/workflows/[wid]/route.ts` — `GET`, `PUT`, `PATCH`, `DELETE /api/workspaces/[id]/workflows/[wid]`
- `src/app/workspace/[id]/page.tsx` — Workspace dashboard page
- `src/app/workspace/[id]/workflow/[wid]/page.tsx` — Workspace-scoped editor page
- `src/app/editor/page.tsx` — Standalone editor (moved from `/`)
- `src/components/workspace/landing-page.tsx` — Landing page component
- `src/components/workspace/dashboard.tsx` — Workspace dashboard component
- `src/components/workspace/workflow-card.tsx` — Workflow card for dashboard grid
- `src/components/workspace/workspace-header.tsx` — Dashboard header with editable name, presence, share
- `src/components/workspace/empty-state.tsx` — Dashboard empty state
- `src/components/workspace/recent-workspaces.tsx` — Recent workspaces list for landing page
- `src/hooks/use-workspace.ts` — Hook for fetching/managing workspace state
- `src/hooks/use-workspace-autosave.ts` — Hook for debounced auto-save to server
- `src/lib/workspace/local-history.ts` — localStorage recent-workspaces management
- `docs/tasks/feature-workspace-foundation-616005e8/e2e-feature-workspace-foundation-616005e8.md` — E2E test plan

## Implementation Plan

### Phase 1: Foundation
Build the server-side persistence layer and API routes. This is the data backbone that everything else depends on.

1. Define workspace/workflow types mirroring Brain's manifest pattern
2. Create config module for workspace data directory (reuses `NEXUS_BRAIN_DATA_DIR`)
3. Implement server-side CRUD: create workspace, create/read/update/delete workflows, read/update workspace manifest
4. Create Zod validation schemas for API request bodies
5. Build all API route handlers following Brain's route pattern

### Phase 2: Core Implementation
Build the UI pages and components: landing page, dashboard, and workspace-scoped editor.

1. Create landing page component with CTA cards and recent workspaces list
2. Build workspace dashboard with workflow card grid, presence, and share
3. Implement workspace-scoped editor page that loads workflow from server and starts Y.js
4. Move existing standalone editor to `/editor` route
5. Wire up stable Y.js room IDs derived from workspace+workflow IDs
6. Implement debounced auto-save (30s) and best-effort save on unload

### Phase 3: Integration
Connect all pieces, add workspace context to the editor header, and ensure the standalone editor is unaffected.

1. Add workspace breadcrumb to editor header
2. Make workflow name editable via workspace API (PATCH)
3. Add presence avatars to dashboard using existing awareness infrastructure
4. Implement live-editing indicator on workflow cards
5. Wire recent-workspaces localStorage tracking
6. Ensure standalone `/editor` path works identically to the current root

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Define Workspace Types and Config
- Create `src/lib/workspace/types.ts`:
  - `WorkspaceRecord`: `{ id: string (nanoid 21), name: string, createdAt: string, updatedAt: string }`
  - `WorkflowRecord`: `{ id: string (nanoid 21), workspaceId: string, name: string, createdAt: string, updatedAt: string, lastModifiedBy: string }`
  - `WorkspaceManifest`: `{ version: 1, workspace: WorkspaceRecord, workflows: WorkflowRecord[] }`
- Create `src/lib/workspace/config.ts`:
  - `getWorkspaceConfig()` returning `{ dataDir: string }` where `dataDir` = `path.join(NEXUS_BRAIN_DATA_DIR or cwd fallback, "workspaces")`
  - Follow the cached-config pattern from `src/lib/brain/config.ts`

### 2. Implement Server-Side Workspace Persistence
- Create `src/lib/workspace/server.ts` mirroring Brain's server.ts patterns:
  - `createWorkspace(name: string)`: generates nanoid(21), creates dir `{dataDir}/{id}/`, writes `manifest.json` with workspace record and empty workflows array, creates `workflows/` subdir. Returns `WorkspaceRecord`.
  - `getWorkspace(id: string)`: reads `{dataDir}/{id}/manifest.json`, returns `WorkspaceManifest` (workspace record + workflow metadata list).
  - `updateWorkspace(id: string, updates: { name })`: updates manifest workspace record, bumps `updatedAt`.
  - `createWorkflow(workspaceId: string, name: string)`: generates nanoid(21), adds `WorkflowRecord` to manifest, writes empty workflow JSON file at `{dataDir}/{workspaceId}/workflows/{workflowId}.json` with default `WorkflowJSON` shape. Returns `WorkflowRecord`.
  - `getWorkflow(workspaceId: string, workflowId: string)`: reads `{dataDir}/{workspaceId}/workflows/{workflowId}.json`, returns full `WorkflowJSON`.
  - `saveWorkflow(workspaceId: string, workflowId: string, data: WorkflowJSON, lastModifiedBy: string)`: writes workflow JSON file, updates manifest record's `updatedAt` and `lastModifiedBy`.
  - `updateWorkflowMeta(workspaceId: string, workflowId: string, updates: { name })`: updates manifest record only.
  - `deleteWorkflow(workspaceId: string, workflowId: string)`: removes workflow JSON file, removes record from manifest.
- Use `fs.mkdir({ recursive: true })`, `fs.readFile`/`fs.writeFile` with JSON parse/stringify, same as Brain.
- Use `customAlphabet` from nanoid for 21-char IDs.

### 3. Create Zod Validation Schemas
- Create `src/lib/workspace/schemas.ts`:
  - `CreateWorkspaceSchema`: `{ name: z.string().min(1).max(100) }`
  - `UpdateWorkspaceSchema`: `{ name: z.string().min(1).max(100) }`
  - `CreateWorkflowSchema`: `{ name: z.string().min(1).max(200) }`
  - `SaveWorkflowSchema`: `{ data: z.record(z.unknown()), lastModifiedBy: z.string().min(1) }` (loose validation — WorkflowJSON is complex; trust client shape)
  - `UpdateWorkflowMetaSchema`: `{ name: z.string().min(1).max(200) }`
- Import Zod from `"zod/v4"` per project convention.

### 4. Build API Routes
- Create `src/app/api/workspaces/route.ts`:
  - `POST`: parse body with `CreateWorkspaceSchema`, call `createWorkspace(name)`, return 201 with workspace record.
- Create `src/app/api/workspaces/[id]/route.ts`:
  - `GET`: call `getWorkspace(id)`, return 200 with manifest (workspace + workflow metadata). Return 404 if not found.
  - `PATCH`: parse body with `UpdateWorkspaceSchema`, call `updateWorkspace(id, updates)`, return 200.
- Create `src/app/api/workspaces/[id]/workflows/route.ts`:
  - `POST`: parse body with `CreateWorkflowSchema`, call `createWorkflow(id, name)`, return 201 with workflow record.
- Create `src/app/api/workspaces/[id]/workflows/[wid]/route.ts`:
  - `GET`: call `getWorkflow(id, wid)`, return 200 with full WorkflowJSON. 404 if not found.
  - `PUT`: parse body with `SaveWorkflowSchema`, call `saveWorkflow(id, wid, data, lastModifiedBy)`, return 200.
  - `PATCH`: parse body with `UpdateWorkflowMetaSchema`, call `updateWorkflowMeta(id, wid, updates)`, return 200.
  - `DELETE`: call `deleteWorkflow(id, wid)`, return 204.
- Follow Brain's route handler pattern: `NextRequest`/`NextResponse`, try/catch with `{ error }` JSON responses, proper status codes.

### 5. Create localStorage Recent-Workspaces Module
- Create `src/lib/workspace/local-history.ts`:
  - `STORAGE_KEY = "nexus:recent-workspaces"`
  - `RecentWorkspaceEntry`: `{ id, name, workflowCount, memberNames: string[] (max 3), lastAccessedAt: string }`
  - `getRecentWorkspaces(): RecentWorkspaceEntry[]` — parse from localStorage, return max 10, sorted most-recent-first.
  - `addRecentWorkspace(entry: RecentWorkspaceEntry)`: upsert by ID, move to front, trim to 10. Store to localStorage.
  - Guard `typeof window === "undefined"` checks for SSR safety.

### 6. Create Landing Page
- Update `src/app/page.tsx` to render the new landing page component instead of `WorkflowEditor`.
- Create `src/components/workspace/landing-page.tsx` ("use client"):
  - Two CTA cards side by side:
    - "Open Editor" — navigates to `/editor` (standalone mode)
    - "Open Workspace" — navigates to create/join flow (initially just creates a new workspace via `POST /api/workspaces`)
  - "New workspace" button that calls `POST /api/workspaces` with a default name (e.g., "My Workspace"), then navigates to `/workspace/[id]`.
  - "Recent workspaces" list below CTAs using `getRecentWorkspaces()`. Each entry shows: workspace name, last-accessed time (relative), workflow count, up to 3 member initial badges. Clicking navigates to `/workspace/[id]`.
- Use existing shadcn/ui `Card`, `Button` components. Dark theme styling consistent with `BG_SURFACE`, `BORDER_DEFAULT` tokens from `@/lib/theme`.
- Use `next/navigation` `useRouter()` for navigation.

### 7. Move Standalone Editor to `/editor`
- Create `src/app/editor/page.tsx`:
  - Import and render `WorkflowEditor` exactly as the current `src/app/page.tsx` does.
  - This preserves the entire standalone editor experience at a new path.
- The root `src/app/page.tsx` now renders the landing page (done in step 6).

### 8. Create Workspace Dashboard Page
- Create `src/app/workspace/[id]/page.tsx`:
  - Server component or client component that renders `<WorkspaceDashboard workspaceId={params.id} />`.
- Create `src/hooks/use-workspace.ts`:
  - `useWorkspace(workspaceId: string)` hook that fetches `GET /api/workspaces/[id]` on mount, returns `{ workspace, workflows, isLoading, error, refetch }`.
- Create `src/components/workspace/dashboard.tsx` ("use client"):
  - Uses `useWorkspace(workspaceId)` to fetch data.
  - Renders `WorkspaceHeader` at top.
  - Shows loading skeletons while fetching.
  - Shows `EmptyState` if no workflows.
  - Renders workflow card grid with `WorkflowCard` components.
  - Renders a "New Workflow" dashed-border card at the end of the grid.
  - On "New Workflow" click: calls `POST /api/workspaces/[id]/workflows` with name "Untitled Workflow", then navigates to `/workspace/[id]/workflow/[newWid]`.
  - On workspace load, calls `addRecentWorkspace()` with workspace info.

### 9. Build Dashboard Sub-Components
- Create `src/components/workspace/workspace-header.tsx`:
  - Editable workspace name (inline input, saves on blur/Enter via `PATCH /api/workspaces/[id]`).
  - Presence avatars (reuse `PresenceAvatars` or build dashboard-specific variant using awareness store).
  - "Share" button that copies `window.location.href` to clipboard and shows a toast.
- Create `src/components/workspace/workflow-card.tsx`:
  - Card showing: workflow name, last-modified relative timestamp, last-modified-by display name.
  - "Open" button navigating to `/workspace/[id]/workflow/[wid]`.
  - Live-editing green dot indicator (checks if any peers are in the workflow's Y.js room — can use awareness or a lightweight presence check; for MVP, this can be based on dashboard-level awareness that tracks which workflows have active rooms).
  - Context actions: rename (inline edit, calls `PATCH`), delete (calls `DELETE`, refreshes list).
- Create `src/components/workspace/empty-state.tsx`:
  - Illustration/icon + "Create your first workflow" button (same action as "New Workflow" card).
- Create `src/components/workspace/recent-workspaces.tsx`:
  - Renders the recent workspaces list for the landing page.
  - Each entry: workspace name, relative timestamp, workflow count badge, up to 3 member initial circles.
  - Clicking navigates to `/workspace/[id]`.

### 10. Create Workspace-Scoped Editor Page
- Create `src/app/workspace/[id]/workflow/[wid]/page.tsx`:
  - Client component that renders `WorkflowEditor` with workspace context props: `workspaceId`, `workflowId`.
  - Before rendering the editor, fetches `GET /api/workspaces/[id]/workflows/[wid]` to get the initial `WorkflowJSON`.
  - Passes `initialWorkflow` data to the editor.
- Modify `src/components/workflow/workflow-editor.tsx` to accept optional `workspaceId`, `workflowId`, and `initialWorkflow` props:
  - When workspace props are present, load the workflow from the passed data instead of localStorage.
  - Start Y.js room with stable room ID: `nexus-ws-{workspaceId}-{workflowId}`.
  - Skip localStorage-based save/load when in workspace mode.

### 11. Wire Stable Y.js Room IDs for Workspace Workflows
- Update `src/lib/collaboration/config.ts`:
  - Add `buildWorkspaceRoomId(workspaceId: string, workflowId: string): string` returning `nexus-ws-${workspaceId}-${workflowId}`.
  - Add `buildWorkspaceCollabShareUrl(workspaceId: string, workflowId: string): string` returning `${origin}/workspace/${workspaceId}/workflow/${workflowId}`.
- Update collaboration start logic in `workflow-editor.tsx` (or `use-collaboration.ts`):
  - In workspace mode, use `buildWorkspaceRoomId()` instead of generating a random room ID.
  - In workspace mode, the share URL is the workspace workflow URL (no `?room=` param needed).

### 12. Implement Auto-Save to Server
- Create `src/hooks/use-workspace-autosave.ts`:
  - `useWorkspaceAutosave({ workspaceId, workflowId, displayName })` hook.
  - Subscribes to workflow store changes.
  - Debounces by 30 seconds after last local change.
  - Calls `PUT /api/workspaces/[id]/workflows/[wid]` with current `WorkflowJSON` and `lastModifiedBy`.
  - Returns `{ isSaving, lastSavedAt }` for UI feedback.
- Add best-effort save on unload: in the hook, register `beforeunload` event that calls `navigator.sendBeacon` with the current workflow state to the PUT endpoint (note: sendBeacon only supports POST, so may need a dedicated save endpoint or use `fetch` with `keepalive: true`).
- Wire this hook into the workspace-scoped editor page.

### 13. Add Workspace Context to Editor Header
- Update `src/components/workflow/header.tsx`:
  - Accept optional `workspaceContext` prop: `{ workspaceId, workspaceName, workflowId }`.
  - When workspace context is present:
    - Show breadcrumb "← {workspaceName}" before the workflow name that navigates to `/workspace/[id]`.
    - Workflow name rename calls `PATCH /api/workspaces/[id]/workflows/[wid]` instead of local rename.
    - Share button copies the workspace workflow URL.
    - Hide standalone-only actions (e.g., "Save to Library") that don't apply in workspace mode.
- Update `src/components/workflow/header/workflow-name-card.tsx`:
  - Accept optional `onRename` callback for workspace-mode rename.
- Update `src/components/workflow/collaboration/share-button.tsx`:
  - Accept optional `shareUrl` override for workspace mode.

### 14. Wire Dashboard Presence and Live-Editing Indicators
- On the workspace dashboard, use awareness to show which peers are on the dashboard.
  - When dashboard loads, join a dashboard-level Y.js room: `nexus-ws-{workspaceId}-dashboard` (lightweight, just for presence).
  - Show presence avatars in the dashboard header.
- For live-editing indicators on workflow cards:
  - The dashboard awareness room can track which workflows have active peer connections. Alternatively, for MVP, rely on a simple polling mechanism or skip the live dot and add it as a follow-up.
  - Recommended MVP approach: each peer on the dashboard sets their awareness state to include `{ currentWorkflowId: null }` (on dashboard). Peers in a workflow editor set `{ currentWorkflowId: wid }`. The dashboard reads all peers' awareness across the workspace to determine which workflows have active editors.
  - Simpler MVP alternative: skip live dots on workflow cards for initial implementation; mark as future enhancement.

### 15. Update Docker Compose
- Workspace data reuses the existing `NEXUS_BRAIN_DATA_DIR` volume (workspaces stored under `{NEXUS_BRAIN_DATA_DIR}/workspaces/`). No new volume or env var needed since the workspace config module reads from the same `NEXUS_BRAIN_DATA_DIR`.

### 16. Create E2E Test Plan
- Create `docs/tasks/feature-workspace-foundation-616005e8/e2e-feature-workspace-foundation-616005e8.md` with the following structure:
  - **User Story**: Validate that workspace creation, dashboard navigation, workflow CRUD, real-time collaboration, and standalone editor all function correctly.
  - **Test Steps**:
    1. Navigate to `/` — verify landing page renders with "Open Editor" and "Open Workspace" CTA cards.
    2. Click "New workspace" — verify redirect to `/workspace/[id]` dashboard.
    3. Verify dashboard shows workspace name, empty state with "Create your first workflow" button.
    4. Click "Create your first workflow" — verify redirect to `/workspace/[id]/workflow/[wid]`.
    5. In the editor, add a Start node and a Prompt node, connect them, name the workflow "Test Flow".
    6. Wait 35 seconds for auto-save debounce to fire.
    7. Navigate back to dashboard via breadcrumb "←" — verify "Test Flow" appears in workflow card grid with last-modified timestamp.
    8. Open the same workflow again — verify the nodes and edges persist from server load.
    9. Copy the workspace URL via Share button — verify clipboard contains `/workspace/[id]`.
    10. Navigate to `/` — verify the workspace appears in "Recent workspaces" with correct name and workflow count.
    11. Navigate to `/editor` — verify standalone editor works with no workspace context, all existing features functional.
    12. Rename workspace from dashboard header — verify name updates.
    13. Rename workflow from card context menu — verify name updates.
    14. Delete a workflow — verify card disappears from grid.
  - **Success Criteria**: All steps complete without errors. Server persists workspace/workflow data. Standalone editor unaffected.
  - **Screenshot Capture Points**: Landing page, empty dashboard, dashboard with workflow cards, editor with workspace breadcrumb, standalone editor.

### 17. Run Validation Commands
- Run `bun run typecheck` — must pass with zero errors.
- Run `bun run lint` — must pass.
- Run `bun run build` — must pass (routing changes, new pages, new API routes all affect build).
- Run `bun run test` (if tests exist) — must pass with no regressions.

## Testing Strategy

### Unit Tests
- **Workspace server module** (`src/lib/workspace/server.ts`): Test `createWorkspace`, `getWorkspace`, `createWorkflow`, `getWorkflow`, `saveWorkflow`, `deleteWorkflow` with a temp directory. Verify manifest updates, file creation/deletion, error cases (not found).
- **Zod schemas** (`src/lib/workspace/schemas.ts`): Test validation passes/fails for each schema with valid and invalid inputs.
- **Local history** (`src/lib/workspace/local-history.ts`): Test `addRecentWorkspace` upsert, ordering, max-10 trim, `getRecentWorkspaces` sorting.
- **Room ID derivation**: Test `buildWorkspaceRoomId` returns deterministic `nexus-ws-{wsId}-{wfId}` format.

### Edge Cases
- Workspace with no workflows (empty dashboard state).
- Concurrent saves from multiple peers (Y.js CRDT handles merge; server receives last-writer-wins snapshots — acceptable for MVP).
- Invalid workspace ID in URL (404 handling on dashboard).
- Invalid workflow ID in URL (404 handling in editor).
- Workspace name at max length (100 chars).
- Workflow name at max length (200 chars).
- Browser with localStorage disabled (recent workspaces gracefully empty).
- Navigation away during auto-save debounce (beforeunload save attempt).
- Creating a workflow while another peer is on the dashboard (dashboard should show new card on refetch).

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

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

- `bun run typecheck` — TypeScript type check (zero errors)
- `bun run lint` — ESLint code quality check (zero errors)
- `bun run build` — Next.js production build (verifies routing, API routes, page components all wire correctly)

## Notes
- **No authentication**: Per BD-1, access is invite-link only. Anyone with the workspace URL can join and edit. No auth middleware.
- **File persistence under NEXUS_BRAIN_DATA_DIR**: Workspace data lives at `{NEXUS_BRAIN_DATA_DIR}/workspaces/{id}/`. This reuses the existing Docker volume mount. No new env vars needed.
- **Dashboard presence (live dots)**: The spec calls for live-editing indicators (FR-19, AC-4). For MVP, consider implementing this via a shared awareness room for the workspace, or defer to a follow-up if the implementation proves complex. The plan includes it in step 14 but flags it as potentially simplifiable.
- **Auto-save with sendBeacon**: `navigator.sendBeacon` only supports POST. For the `beforeunload` save, either use a dedicated `POST /api/workspaces/[id]/workflows/[wid]/save` endpoint that accepts the same body as the PUT, or use `fetch` with `keepalive: true` for the PUT. The `keepalive` approach is cleaner.
- **Spec dependency**: This workspace foundation is a prerequisite for `spec-workspace-recent-changes.md`. The `lastModifiedBy` and `updatedAt` fields established here will be consumed by that follow-up spec.
- **Standalone editor preservation**: FR-33 and BD-5 require the existing editor to remain fully functional. The `/editor` route must render the exact same `WorkflowEditor` component with no workspace context. All localStorage-based flows must continue working.

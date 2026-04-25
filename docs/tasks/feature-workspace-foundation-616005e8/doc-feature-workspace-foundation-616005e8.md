# Workspace Foundation

**ADW ID:** 616005e8
**Date:** 2026-04-14
**Plan:** docs/tasks/feature-workspace-foundation-616005e8/plan-feature-workspace-foundation-616005e8.md

## Overview

Introduces a workspace model that lets teams create shared environments containing multiple workflows, share a workspace URL with teammates, and collaboratively edit individual workflows in real time. Workspace and workflow data are persisted server-side (mirroring the Brain file-store pattern) so state survives across devices and browser sessions. The existing standalone editor moves to `/editor` and continues to work unchanged.

## What Was Built

- Landing page at `/` with "Open Editor" / "New Workspace" CTAs and a recent-workspaces list
- Workspace dashboard at `/workspace/[id]` with editable name, share button, presence avatars, workflow card grid, and a "New Workflow" affordance
- Workspace-scoped editor at `/workspace/[id]/workflow/[wid]` with workspace breadcrumb, stable Y.js room IDs, and 30s debounced auto-save
- Server-side persistence layer (`src/lib/workspace/`) mirroring the Brain manifest pattern under `{NEXUS_BRAIN_DATA_DIR}/workspaces/`
- REST API routes for workspaces and nested workflows (create, read, update, delete)
- Standalone editor preserved at `/editor` with no workspace dependency
- Local-history helper that tracks recently visited workspaces in `localStorage`
- Share-button clipboard path with a textarea fallback for non-secure contexts

## Technical Implementation

### Files Modified

- `src/app/page.tsx`: Renders the new landing page (previously rendered `WorkflowEditor`).
- `src/app/editor/page.tsx`: New route hosting the standalone `WorkflowEditor`.
- `src/app/workspace/[id]/page.tsx`: Server shell that renders the workspace dashboard.
- `src/app/workspace/[id]/workflow/[wid]/page.tsx`: Workspace-scoped editor shell.
- `src/app/api/workspaces/**`: CRUD routes for workspaces and workflows (`POST /api/workspaces`, `GET|PATCH /api/workspaces/[id]`, `POST /api/workspaces/[id]/workflows`, `GET|PUT|PATCH|DELETE /api/workspaces/[id]/workflows/[wid]`).
- `src/lib/workspace/{types,config,schemas,server,local-history}.ts`: Types, cached config, Zod schemas, server CRUD, and recent-workspaces `localStorage` helper.
- `src/components/workspace/{landing-page,dashboard,workflow-card,workspace-header,empty-state,recent-workspaces}.tsx`: Landing, dashboard, and header UI.
- `src/hooks/{use-workspace,use-workspace-autosave}.ts`: Workspace fetch hook and debounced auto-save with `fetch({ keepalive: true })` best-effort save on unload.
- `src/components/workflow/workflow-editor.tsx`: Accepts `workspaceId` / `workflowId` / `initialWorkflow` and switches to server-backed loading and stable Y.js rooms in workspace mode.
- `src/components/workflow/header*.tsx`: Header gains a workspace breadcrumb; rename goes through `PATCH /api/workspaces/[id]/workflows/[wid]` when in workspace mode.
- `src/components/workflow/collaboration/{share-button,use-collaboration}.ts(x)`: Share button accepts a workspace URL override with a clipboard fallback.
- `src/lib/collaboration/{collab-doc,config,object-store,index}.ts`: Adds `buildWorkspaceRoomId`, `buildWorkspaceCollabShareUrl`, and an object-store wrapper for persisted room snapshots.
- `src/components/workflow/brain-panel/*`: Minor adjustments to keep the Brain panel working inside workspace-loaded editors.
- `scripts/{start.sh,collab-server.ts}`, `Dockerfile`, `docker-compose.yml`, `.env.example`: Startup wiring for the collab server and shared data volume.

### Key Changes

- **Persistence layer** mirrors Brain's manifest pattern: each workspace lives in `{NEXUS_BRAIN_DATA_DIR}/workspaces/{id}/` with a `manifest.json` and a `workflows/{wid}.json` file per workflow. IDs are 21-char nanoids.
- **Stable Y.js rooms**: workspace workflows derive room IDs as `nexus-ws-{workspaceId}-{workflowId}` so every visitor of the same URL joins the same CRDT room.
- **Auto-save**: `useWorkspaceAutosave` subscribes to the workflow store, debounces writes by 30s, and performs a best-effort `fetch` with `keepalive: true` on `beforeunload`.
- **Routing**: `/` is now the landing page, `/editor` hosts the untouched standalone experience, and `/workspace/[id]/...` hosts the collaborative flow.
- **No auth**: access is invite-link only; anyone with the URL can join and edit (per BD-1).

## How to Use

1. Visit `/`. Click **New Workspace** to create one, or pick a workspace from the recent list.
2. On the workspace dashboard, rename the workspace inline, then click **New Workflow** to create a workflow.
3. Edit the workflow. Changes auto-save every 30 seconds; a best-effort save also runs on tab close.
4. Click **Share** in the dashboard header or editor to copy the workspace/workflow URL. Anyone with the link joins the same live session.
5. Use the breadcrumb in the editor header to navigate back to the workspace dashboard.
6. Use `/editor` for the standalone (local-only, no workspace) editor.

## Configuration

- `NEXUS_BRAIN_DATA_DIR` — workspace data is stored under `{NEXUS_BRAIN_DATA_DIR}/workspaces/`. Reuses the existing Brain volume; no new env var is required.
- `NEXUS_COLLAB_DATA_DIR`, `NEXUS_BRAIN_TOKEN_SECRET`, and related collab vars continue to apply to the collab server (`scripts/collab-server.ts`).
- `.env.example` lists the current recommended values.

## Testing

- `bun run typecheck`, `bun run lint`, `bun run build` must pass.
- Unit tests: `src/lib/__tests__/brain-server.test.ts`, `src/lib/__tests__/collaboration-object-store.test.ts`.
- Manual E2E: follow `docs/tasks/feature-workspace-foundation-616005e8/e2e-feature-workspace-foundation-616005e8.md` (create workspace → create workflow → auto-save → reopen → share URL in second browser → verify live sync → verify `/editor` still works).

## Notes

- `lastModifiedBy` and `updatedAt` are populated on every save and are consumed by the planned `spec-workspace-recent-changes` follow-up.
- Server receives last-writer-wins snapshots; intra-session merging is handled by Y.js. This is acceptable for MVP.
- Live-editing dots on workflow cards are driven by workspace-scoped awareness; if it proves flaky, it can be removed without affecting persistence.
- The share-button clipboard helper falls back to a hidden `textarea` + `document.execCommand("copy")` for non-secure contexts; failures surface a toast instead of being silently swallowed.

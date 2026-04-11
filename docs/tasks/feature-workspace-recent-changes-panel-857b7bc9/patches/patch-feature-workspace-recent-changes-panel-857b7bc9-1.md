# Patch: Differentiate Open Workspace and New Workspace actions

## Metadata
adw_id: `docs/tasks/feature-workspace-recent-changes-panel-857b7bc9/patches/patch-feature-workspace-recent-changes-panel-857b7bc9-1.md`
review_change_request: `The workspace management needs to be improved. We need to have a way to edit and select different workspaces. Right now, there's just a recent history dropdown, but that's confusing. "Open" should open a list of the workspaces you currently have, and "New" should create a new one. Right now they both do the same function.`

## Issue Summary
**Original Plan:** docs/tasks/feature-workspace-recent-changes-panel-857b7bc9/plan-feature-workspace-recent-changes-panel-857b7bc9.md
**Issue:** In `src/components/workspace/landing-page.tsx`, both the "Open Workspace" card button and the "New workspace" button call the same `handleNewWorkspace()` handler, which always creates a new workspace via `POST /api/workspaces`. There is no way to browse and select an existing workspace — the only path to existing workspaces is through the "Recent workspaces" list below, which is not intuitive.
**Solution:** 
1. Add a `GET` handler to the `/api/workspaces` route that lists all workspace directories from disk.
2. Add a `listWorkspaces()` function to `server.ts`.
3. Change the "Open Workspace" button to open a dialog/sheet that fetches and displays all existing workspaces for selection.
4. Keep the "New workspace" button as-is (creates a new workspace).

## Files to Modify

- **`src/lib/workspace/server.ts`** — Add `listWorkspaces()` function to scan the data directory for workspace manifests.
- **`src/app/api/workspaces/route.ts`** — Add `GET` handler that calls `listWorkspaces()`.
- **`src/components/workspace/landing-page.tsx`** — Change "Open Workspace" button to open a workspace picker dialog instead of creating a new workspace. Add workspace picker dialog with loading state, empty state, and clickable workspace entries.

## Implementation Steps
IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Add `listWorkspaces()` to server.ts
- In `src/lib/workspace/server.ts`, add a new exported function `listWorkspaces()` that:
  1. Reads the workspace data directory (`getWorkspaceConfig().dataDir`).
  2. Lists subdirectories using `fs.readdir` with `withFileTypes: true`.
  3. For each subdirectory, attempts to read its `manifest.json` via `readJsonFile`.
  4. Returns an array of `WorkspaceRecord` objects (id, name, createdAt, updatedAt) sorted by `updatedAt` descending.
  5. Gracefully skips directories without a valid manifest.

### Step 2: Add GET handler to `/api/workspaces` route
- In `src/app/api/workspaces/route.ts`, add a `GET` handler:
  - Calls `listWorkspaces()` from `server.ts`.
  - Returns `{ workspaces: WorkspaceRecord[] }` as JSON.
  - Wraps in try/catch with 500 error handling, matching existing POST handler pattern.

### Step 3: Update landing page with workspace picker
- In `src/components/workspace/landing-page.tsx`:
  - Add `showPicker` state (boolean, default false).
  - Change the "Open Workspace" button's `onClick` to set `showPicker(true)`.
  - Add an inline workspace picker section (rendered conditionally when `showPicker` is true) that:
    1. Fetches `GET /api/workspaces` on open via a `useEffect`.
    2. Shows a loading spinner while fetching.
    3. If no workspaces exist, shows "No workspaces yet" empty state with a prompt to create one.
    4. Lists workspaces as clickable rows (name, last updated time) — clicking navigates to `/workspace/{id}`.
    5. Has a "Cancel" or close button to hide the picker.
  - Use existing theme tokens (`BG_SURFACE`, `BORDER_DEFAULT`, `TEXT_PRIMARY`, `TEXT_MUTED`) and patterns from `recent-workspaces.tsx` for consistent styling.
  - Keep the "New workspace" button unchanged — it continues to call `handleNewWorkspace()`.

## Validation
Execute every command to validate the patch is complete with zero regressions.

```bash
bun run typecheck
bun run lint
bun run build
```

## Patch Scope
**Lines of code to change:** ~80-100
**Risk level:** low
**Testing required:** Manual verification that "Open Workspace" shows a picker of existing workspaces, "New workspace" creates a new workspace, and existing recent workspaces list still works.

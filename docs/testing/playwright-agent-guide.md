# Playwright Agent Guide

This guide is for agents and contributors testing Nexus Workflow Studio in a browser with `playwright-cli`. It documents project-specific routes, optional authentication behavior, browser state handling, screenshots, and representative feature workflows.

## Purpose and scope

- Use this guide for manual or agent-driven browser smoke tests of Nexus Workflow Studio.
- The app is frontend-first and can be tested without assuming a separate backend service.
- Runtime application behavior is not changed by this guide.
- Do not treat `playwright-cli` element refs as stable. Always run `snapshot` after navigation and UI changes before using a ref.

## Prerequisites

1. Install dependencies and start the frontend development server according to the repository setup instructions.
2. Use the configured frontend URL. In local development this is usually:

   ```text
   http://localhost:3000
   ```

3. No backend server is required for normal editor, workspace, local persistence, import, or export checks.
4. OpenCode is optional. Only test AI workflow generation, AI prompt generation, dynamic model discovery, or dynamic tool discovery when an OpenCode server is intentionally running.

## Browser and session lifecycle

Create screenshot and auth-state directories before they are needed:

```bash
mkdir -p .playwright-screenshots .playwright-auth
```

Typical command sequence:

```bash
playwright-cli open http://localhost:3000
playwright-cli snapshot
playwright-cli screenshot --filename=.playwright-screenshots/landing.png
playwright-cli goto http://localhost:3000/editor
playwright-cli snapshot
playwright-cli screenshot --filename=.playwright-screenshots/editor-loaded.png
playwright-cli state-save .playwright-auth/nexus-auth.json
playwright-cli close
```

Use these conventions:

- `open` starts a browser page at the app URL.
- `snapshot` discovers current accessible text, labels, and action refs. Run it before each click/type sequence and after every navigation, dialog, canvas change, or significant re-render.
- `goto` navigates directly to known routes.
- `state-save .playwright-auth/nexus-auth.json` stores a reusable browser state after any required sign-in.
- `state-load .playwright-auth/nexus-auth.json` can restore that state in a later session.
- `close` ends the browser session.
- Save screenshots under `.playwright-screenshots/` with descriptive names such as `landing.png`, `editor-loaded.png`, `workspace-dashboard.png`, or `auth-signin.png`.
- Never print or screenshot secrets, tokens, cookies, provider credentials, or raw auth state contents.

## Route map and expected landmarks

| Route | Expected landmarks | Notes |
| --- | --- | --- |
| `/` | `Nexus Workflow Studio`, `Open Editor`, `Open Workspace`, `New workspace`, recent workspaces area | Landing page. `Open Editor` navigates to the standalone editor. `Open Workspace` and `New workspace` create a workspace, then navigate to its dashboard. |
| `/editor` | Workflow editor header, editable workflow name, canvas, node palette, canvas toolbar, generate/export actions, properties panel when a node is selected | Standalone editor. Saves client-side using local persistence. |
| `/workspace/[id]` | Workspace header, loading spinner while fetching, workspace name, empty state or workflow cards, `New Workflow` control | Workspace dashboard. The workspace id comes from creating/opening a workspace. |
| `/workspace/[id]/workflow/[wid]` | Loading state, then workflow editor in workspace mode | This route exists in the current tree. It fetches `/api/workspaces/[id]/workflows/[wid]` and shows `Workflow not found` or `Failed to load workflow` if the workflow cannot be loaded. |
| `/api/auth/signin` | NextAuth sign-in page/provider controls | Reached when auth is enabled and the user is unauthenticated. |

## Authentication guide

Default local development normally has authentication disabled. Auth is enabled only when all of these environment variables are present:

- `AUTH_ISSUER`
- `AUTH_CLIENT_ID`
- `AUTH_CLIENT_SECRET`
- `AUTH_SECRET`

If some but not all required variables are present, Nexus logs a partial-auth warning and authentication remains disabled. When auth is disabled, page routes such as `/` and `/editor` should load without sign-in.

When auth is enabled:

1. Open the app at `/`.
2. Expect protected page routes to redirect to `/api/auth/signin` with a callback URL.
3. Complete the provider login manually or with approved test credentials.
4. After returning to the app, save reusable browser state if needed:

   ```bash
   mkdir -p .playwright-auth
   playwright-cli state-save .playwright-auth/nexus-auth.json
   ```

5. In future sessions, load the saved state instead of repeating sign-in:

   ```bash
   playwright-cli state-load .playwright-auth/nexus-auth.json
   playwright-cli goto http://localhost:3000
   playwright-cli snapshot
   ```

For protected API routes with auth enabled and no valid session, expect JSON like this with HTTP status `401`:

```json
{ "error": "Unauthorized" }
```

## Core feature workflows

### Landing page to standalone editor

1. `open` the frontend URL.
2. Run `snapshot` and confirm the landing page heading and controls are visible.
3. Click `Open Editor` using the current snapshot ref.
4. Run `snapshot` again after navigation.
5. Confirm the standalone editor shell loaded: header, workflow name, canvas, palette, and toolbar.
6. Capture `.playwright-screenshots/editor-loaded.png`.

### Landing page to new workspace/dashboard

1. Start at `/` and run `snapshot`.
2. Click either `Open Workspace` or `New workspace`.
3. Run `snapshot` after navigation/loading completes.
4. Confirm the URL is under `/workspace/[id]` and the dashboard shows a workspace header plus either an empty state or workflow cards.
5. Capture `.playwright-screenshots/workspace-dashboard.png`.

### Create a workflow from a workspace dashboard

1. From `/workspace/[id]`, run `snapshot`.
2. Use the visible workflow creation control, such as the empty-state create action or `New Workflow`.
3. Run `snapshot` after navigation.
4. In the current tree, the dashboard creates a workflow then navigates to `/workspace/[id]/workflow/[wid]`, which is implemented as a workspace-scoped editor route.
5. If loading fails, record the visible error (`Workflow not found` or `Failed to load workflow`) and inspect the relevant network/API response.
6. Capture `.playwright-screenshots/workspace-workflow-editor.png` when the editor loads.

### Basic editor smoke test

1. Open `/editor` directly or navigate from the landing page.
2. Run `snapshot` and verify the editor shell is present.
3. Inspect the visible node palette and controls from the current snapshot.
4. Add or inspect nodes using visible UI controls. If interacting with the canvas, prefer accessible controls first; use coordinate-based actions only when the canvas interaction has no accessible alternative.
5. Select a node and confirm the properties panel opens when available.
6. Open generate/export or preview controls if visible in the header. Supported generation targets include `OpenCode`, `PI`, and `Claude Code`.
7. Run `snapshot` after each dialog/menu opens, then capture screenshots of key states.

### Local persistence checks

Standalone editor changes are persisted locally in the browser. To smoke test persistence:

1. Modify the workflow name or add/edit visible workflow content.
2. Wait briefly for throttled persistence.
3. Reload or navigate away and back to `/editor`.
4. Run `snapshot` and confirm expected data reappears.
5. Use browser storage inspection only when needed, and avoid logging unrelated localStorage values.

If a test needs a clean state, clear localStorage for the app origin, then reload and run `snapshot` again.

### Optional OpenCode checks

Only test OpenCode-dependent features when an OpenCode server is intentionally running and configured for the frontend origin.

- If OpenCode is disconnected, verify editor-only flows still work offline.
- If connected, smoke test AI workflow generation, AI prompt generation, dynamic model discovery, or tool discovery from visible controls.
- Keep screenshots and logs free of provider secrets, local paths with sensitive data, and tokens.

## Recommended screenshots

Capture screenshots at these points when covered by the test:

- `landing.png` — landing page loaded.
- `editor-loaded.png` — standalone editor shell loaded.
- `workspace-dashboard.png` — workspace dashboard loaded.
- `workspace-create-workflow.png` or `workspace-workflow-editor.png` — workflow creation state or resulting workspace editor.
- `generate-export-dialog.png` — generate/export dialog or menu if tested.
- `auth-signin.png` — sign-in page only when auth is enabled, with no secrets visible.

## Troubleshooting

- **Stale refs after DOM updates:** run `playwright-cli snapshot` again after navigation, opening menus/dialogs, changing canvas state, or waiting for loading to finish.
- **Hidden dialogs or menus:** use the latest snapshot to find the current button/menu text. Check whether Escape or clicking outside is needed to close an existing overlay.
- **Auth redirects:** if `/` or `/editor` redirects to `/api/auth/signin`, auth is enabled. Complete sign-in or load saved auth state. If testing unauthenticated behavior, verify protected API routes return `401` JSON.
- **Canvas interactions:** React Flow canvas actions may not expose stable accessible refs. Prefer palette/header/properties controls where possible, and only fall back to coordinates after documenting the reason.
- **LocalStorage cleanup:** clear app-origin localStorage before tests that require a blank editor or no recent workspaces. Reload after cleanup and run `snapshot`.
- **API 401s:** with auth enabled, unauthenticated API calls should return `{ "error": "Unauthorized" }`. With auth disabled, API failures usually indicate a route/data issue rather than auth.
- **Console/network inspection:** inspect logs and network responses for failed workspace creation/loading, OpenCode connection errors, or persistence issues. Do not print secrets or auth tokens.

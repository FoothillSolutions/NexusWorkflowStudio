# E2E Test Specification: Workspace Recent Changes Panel

## User Story
Validate that a returning user sees a changes panel on the workspace dashboard showing node-level changes made by other users since their last visit.

## Preconditions
- The application is running at `http://localhost:3000`.
- No pre-existing workspace data (clean slate or known workspace ID).

## Test Steps

### Setup via API

1. **Create a workspace** via `POST /api/workspaces` with body `{ "name": "E2E Changes Test" }`. Capture `workspace.id`.
2. **Create a workflow** via `POST /api/workspaces/{id}/workflows` with body `{ "name": "My Workflow" }`. Capture `workflow.id`.
3. **Save workflow with initial nodes** via `PUT /api/workspaces/{id}/workflows/{wid}` with body:
   ```json
   {
     "lastModifiedBy": "Alice",
     "data": {
       "name": "My Workflow",
       "nodes": [
         { "id": "n1", "type": "start", "position": { "x": 0, "y": 0 }, "data": { "type": "start", "label": "Start", "name": "Start" } },
         { "id": "n2", "type": "prompt", "position": { "x": 200, "y": 0 }, "data": { "type": "prompt", "label": "Ask Question", "name": "Ask Question", "promptText": "", "detectedVariables": [], "brainDocId": null } }
       ],
       "edges": [],
       "ui": { "sidebarOpen": true, "minimapVisible": false, "viewport": { "x": 0, "y": 0, "zoom": 1 } }
     }
   }
   ```
4. **Wait briefly** (500ms), then **save again** with an added node and `lastModifiedBy: "Bob"`:
   ```json
   {
     "lastModifiedBy": "Bob",
     "data": {
       "name": "My Workflow",
       "nodes": [
         { "id": "n1", "type": "start", "position": { "x": 0, "y": 0 }, "data": { "type": "start", "label": "Start", "name": "Start" } },
         { "id": "n2", "type": "prompt", "position": { "x": 200, "y": 0 }, "data": { "type": "prompt", "label": "Ask Question", "name": "Ask Question", "promptText": "", "detectedVariables": [], "brainDocId": null } },
         { "id": "n3", "type": "script", "position": { "x": 400, "y": 0 }, "data": { "type": "script", "label": "Process Data", "name": "Process Data", "promptText": "", "detectedVariables": [] } }
       ],
       "edges": [],
       "ui": { "sidebarOpen": true, "minimapVisible": false, "viewport": { "x": 0, "y": 0, "zoom": 1 } }
     }
   }
   ```

### Browser Test Steps

5. **Set localStorage** key `nexus:workspace-last-seen:{workspaceId}` to a timestamp **before** both saves (e.g., 1 hour ago).
6. **Navigate** to `/workspace/{workspaceId}`.
7. **Assert** the changes panel slides in from the right side of the viewport.
8. **Assert** the panel header shows a change count and "since {formatted date}".
9. **Assert** the workflow name "My Workflow" appears as a group header in the panel.
10. **Assert** individual change events show correct user names ("Alice", "Bob") and node names ("Start", "Ask Question", "Process Data").
11. **Assert** colored initial badges are visible (round circles with first letter of user name).
12. **Click "Dismiss"** (the X button) — assert the panel slides out and is no longer visible.
13. **Reload the page** — assert the panel re-appears (last-seen was updated on the prior load, but the saves still happened after the original `since` time set in step 5; however, the new `since` from the markSeen call means only changes after the previous page load would show — depending on timing, panel may or may not appear. To guarantee it appears, reset localStorage again before reload).
14. **Screenshot capture** at: panel visible state, after dismiss.

### No-Changes Scenario

15. **Set localStorage** `nexus:workspace-last-seen:{workspaceId}` to the **current** time.
16. **Reload** the page.
17. **Assert** no changes panel appears.

## Success Criteria
- Panel appears with correct change data grouped by workflow.
- Dismiss works — panel slides out and does not re-appear for the rest of the session.
- Colored initial badges use consistent color hashing (same name = same color).
- The `node_added` events for "Start", "Ask Question" (from Alice's save) and "Process Data" (from Bob's save) are all shown.
- No `node_moved` events appear when only position changes occur.
- Panel does not appear when `last-seen` is set to current time.

## Edge Cases to Verify
- Empty workspace (no workflows) — no panel shown.
- Workflow with no snapshots — no panel shown.
- Very long node names — panel content scrolls.

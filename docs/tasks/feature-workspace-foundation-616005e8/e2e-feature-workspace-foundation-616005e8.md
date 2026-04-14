# E2E Test Plan: Workspace Foundation

## User Story
Validate that workspace creation, dashboard navigation, workflow CRUD, real-time collaboration, and the standalone editor all function correctly after the workspace foundation feature is implemented.

## Test Steps

### 1. Landing Page Renders
- Navigate to `/`
- Verify landing page renders with "Open Editor" and "Open Workspace" CTA cards
- Verify "New workspace" button is present

### 2. Create Workspace
- Click "New workspace" button
- Verify redirect to `/workspace/[id]` dashboard
- Verify the URL contains a valid workspace ID

### 3. Empty Dashboard State
- Verify dashboard shows workspace name ("My Workspace")
- Verify empty state with "Create your first workflow" button is displayed
- Verify workspace header shows editable name and Share button

### 4. Create First Workflow
- Click "Create your first workflow" button
- Verify redirect to `/workspace/[id]/workflow/[wid]`
- Verify the workflow editor loads with an empty canvas

### 5. Edit Workflow
- In the editor, add a Start node and a Prompt node, connect them
- Name the workflow "Test Flow" via the header name card

### 6. Auto-Save Verification
- Wait 35 seconds for the auto-save debounce to fire
- Verify no errors in the console

### 7. Navigate Back to Dashboard
- Click the workspace breadcrumb ("← My Workspace") in the editor header
- Verify redirect to `/workspace/[id]`
- Verify "Test Flow" appears in the workflow card grid
- Verify the card shows a last-modified timestamp

### 8. Workflow Persistence
- Open the "Test Flow" workflow again from the dashboard card
- Verify the nodes and edges persist from the server-loaded data
- Verify the workflow name shows "Test Flow"

### 9. Share Workspace URL
- Copy the workspace URL via the Share button on the dashboard
- Verify clipboard contains `/workspace/[id]`

### 10. Recent Workspaces
- Navigate to `/`
- Verify the workspace appears in the "Recent workspaces" section
- Verify it shows the correct name and workflow count (1)

### 11. Standalone Editor Unaffected
- Navigate to `/editor`
- Verify the standalone editor works with no workspace context
- Verify all existing features are functional (node palette, save to library, export, etc.)
- Verify localStorage-based persistence works

### 12. Rename Workspace
- Navigate to the workspace dashboard
- Click the workspace name to edit it
- Rename to "Renamed Workspace"
- Verify name updates in the header after blur/Enter

### 13. Rename Workflow
- On the dashboard, open the context menu (three dots) on a workflow card
- Click "Rename" and change to "Renamed Flow"
- Verify the card name updates

### 14. Delete Workflow
- On the dashboard, open the context menu on a workflow card
- Click "Delete"
- Verify the card disappears from the grid
- Verify the empty state reappears if no workflows remain

## Success Criteria
- All 14 test steps complete without errors
- Server persists workspace and workflow data across page reloads
- Standalone editor at `/editor` is completely unaffected by workspace changes
- No TypeScript, lint, or build errors

## Screenshot Capture Points
1. Landing page with CTA cards
2. Empty workspace dashboard
3. Dashboard with workflow cards
4. Editor with workspace breadcrumb visible
5. Standalone editor at `/editor` (no workspace context)

# E2E Test Specification: Generic File Storage

## User Story

As a user, I can create workspaces, save workflows, and perform all storage operations without noticing any change — the generic storage layer is transparent.

## Preconditions

- Application is running at `http://localhost:3000`
- No `NEXUS_STORAGE_PROVIDER` env var is set (defaults to `"local"`)
- The `.nexus-brain` data directory is clean or in a known state

## Test Steps

1. **Navigate to the app** at `http://localhost:3000`
2. **Create a new workspace** via the workspace picker
   - Screenshot: after workspace creation
3. **Add a workflow** to the workspace
4. **Add a Start node** and an **Agent node** to the canvas
5. **Save the workflow** (Ctrl+S)
   - Screenshot: after workflow save
6. **Refresh the page** to verify the workflow persists
   - Screenshot: after page refresh showing persisted data
7. **Delete the workflow**
8. **Verify it no longer appears** in the workspace
   - Screenshot: after deletion

## Success Criteria

- All workspace and workflow CRUD operations work identically to before the refactor
- No regressions in save, load, delete, or snapshot behavior
- The storage abstraction is completely transparent to the user — no UI changes, no new error states
- Existing data created before the refactor (if any) continues to load correctly

## Screenshot Capture Points

1. After workspace creation — shows the new workspace in the picker
2. After workflow save — shows the workflow with nodes on canvas
3. After page refresh — confirms data was persisted and reloaded
4. After deletion — confirms the workflow is removed from the workspace

## Additional Verification

- Check that `.nexus-brain/workspaces/` directory structure matches the expected layout (manifest.json, workflows/*.json, snapshots/)
- Verify that Brain documents (if the Knowledge Brain feature is in use) continue to save and load correctly
- Confirm that the collaboration server (if running) still persists room state via the storage provider

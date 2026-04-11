# E2E Test Specification: SpacetimeDB Backend Sync

## User Story

As a workspace user, I want all my workspace data (workspaces, workflows, Brain documents) to persist and sync in real-time through SpacetimeDB, so that I can collaborate with others without relying on the filesystem REST API or Hocuspocus server.

## Prerequisites

- SpacetimeDB server running (via `docker compose up` or standalone)
- `NEXT_PUBLIC_SPACETIME_URI` configured and pointing to the SpacetimeDB instance
- `NEXT_PUBLIC_SPACETIME_DB_NAME` set to the published module name
- SpacetimeDB module published (`spacetime publish -p spacetime/nexus nexus`)
- Generated SpacetimeDB client bindings are current (`./scripts/generate-spacetime-bindings.sh` after schema changes)
- App running with `bun run dev` or built and served

## Test Steps

### 1. Workspace Creation

**Action:** Open the app, navigate to workspace mode, create a new workspace named "E2E Test Workspace".

**Expected:** Workspace appears in the workspace list. Refreshing the page shows the workspace persists.

**Verify:** Check SpacetimeDB `workspace` table contains a row with the workspace name.

---

### 2. Workflow Creation

**Action:** Open the created workspace, create a new workflow named "Test Flow".

**Expected:** Workflow appears in the workspace's workflow list. The workflow editor opens with default Start and End nodes.

**Verify:** `workflow` table has a row for "Test Flow" with the correct `workspaceId`.

---

### 3. Node and Edge Persistence

**Action:** Add three nodes (Start, Agent, End) and connect them: Start → Agent → End.

**Expected:** Nodes and edges appear on the canvas. After page reload, the same nodes and edges are present in their correct positions.

**Verify:** `workflow_node` and `workflow_edge` tables contain the expected rows.

---

### 4. Multi-Tab Sync — Initial Load

**Action:** Open the same workspace/workflow URL in a second browser tab.

**Expected:** Both tabs show the identical workflow with the same nodes, edges, and positions.

---

### 5. Multi-Tab Sync — Node Addition

**Action:** In Tab 1, drag a new "Prompt" node onto the canvas.

**Expected:** The new node appears in Tab 2 within 2 seconds.

**Verify:** `workflow_change_event` table contains a "node_added" event.

---

### 6. Multi-Tab Sync — Node Movement

**Action:** In Tab 2, drag an existing node to a new position.

**Expected:** The node's position updates in Tab 1 within 2 seconds.

---

### 7. Multi-Tab Sync — Node Deletion

**Action:** In Tab 1, select and delete a node.

**Expected:** The node and its connected edges disappear from Tab 2 within 2 seconds.

**Verify:** `workflow_change_event` table contains a "node_deleted" event.

---

### 8. Recent Changes Panel

**Action:** Open the Recent Changes panel in the workspace.

**Expected:** Change events (node added, deleted, etc.) appear in chronological order, sourced from `workflow_change_event` rows.

---

### 9. Brain Document Persistence

**Action:** Create a new Brain document titled "E2E Brain Doc" with some content.

**Expected:** The document persists after page reload. In a second tab, the document appears in the Brain panel.

**Verify:** `brain_doc` table contains the document row.

---

### 10. Invite-Link Access

**Action:** Generate an invite link for the workspace. Open the link in an incognito/private window.

**Expected:** The incognito session connects to SpacetimeDB, calls `join_workspace`, and the workspace loads with all data visible.

**Verify:** `workspace_member` table shows a new member row for the incognito identity.

---

### 11. Network Disconnection Recovery

**Action:** With the workspace open, temporarily disable the network connection (or stop the SpacetimeDB server) for 5 seconds, then reconnect.

**Expected:** The client reconnects automatically. Any changes made during disconnection are not lost (the sync bridge buffers or re-syncs).

**Verify:** No data corruption; the workflow state matches between tabs after reconnection.

---

### 12. Standalone Mode Isolation

**Action:** Navigate to the root editor URL (no workspace context). Create a workflow, add nodes, save to library.

**Expected:** The workflow persists in localStorage. No SpacetimeDB connections are established. The standalone editor behaves identically to pre-SpacetimeDB behavior.

**Verify:** No WebSocket connections to the SpacetimeDB URI in the browser's network tab. localStorage contains the saved workflow.

---

## Success Criteria

- All 12 test steps pass without errors
- No data loss during any sync or reconnection scenario
- Sync latency is under 2 seconds for all multi-tab operations
- Standalone editor/localStorage mode is completely unaffected
- Presence indicators (peer avatars, selected node highlights) update correctly between tabs
- Invite-link flow works for anonymous users

## Screenshots to Capture

1. Workspace creation confirmation
2. Multi-tab sync showing the same workflow in both tabs
3. Invite-link join in incognito window
4. Network disconnection → reconnection recovery
5. Standalone mode with no SpacetimeDB connections

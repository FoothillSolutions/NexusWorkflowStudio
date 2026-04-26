# E2E: Workspace Research And Planning

## User Story
Validate a workspace user can create and collaboratively use Research spaces, run/retry AI enrichment, switch views, synthesize, import/export, and promote to both Brain targets without regressing standalone `/editor`, workspace workflows, or Brain panel behavior.

## Test Steps
Use `playwright-cli` only in the E2E pipeline (do not run from implementation validation):

1. Start the app and create a new workspace from the landing page.
2. On the workspace dashboard, assert the `Workspace Research` entry is visible and open it.
3. Assert the route matches `/workspace/{id}/research` and the full-screen Research surface renders.
4. Create each planning template at least once, or use a minimal matrix that covers Research Brief, PRD, Implementation Plan, and Decision Log creation.
5. Add a freeform tile through the command input and edit its text.
6. Open a second browser context to the same Research URL, edit another tile, and verify live sync in the first context.
7. Trigger enrichment while the connector is unavailable; assert visible `AI not connected`, visible per-tile AI error, and visible `Re-enrich` control.
8. Click `Re-enrich` and assert the retry state/error remains visible instead of blocking note editing.
9. Switch between tiling, kanban, and graph views; assert the same tile content remains visible in each view.
10. Generate synthesis and assert the synthesis panel shows generated content with copy controls.
11. Export a `.nodepad` file, import it into a new/blank space, and assert core tiles and relationships are preserved.
12. Copy/export markdown and assert grouped research content appears in the exported text.
13. Promote selected notes to Workspace Brain and assert a successful promotion message.
14. Promote selected notes to Personal Brain and assert a successful promotion message.
15. Regression: open `/editor` and assert standalone workflow editing still renders.
16. Regression: create/open a workspace workflow and assert workflow saving/collaboration UI still renders.
17. Regression: open the Brain panel and assert promoted Brain documents are reachable.
18. Inspect storage/network where practical and assert there is no nodepad localStorage primary persistence dependency.

## Success Criteria
- The Research dashboard entry is visible with text `Workspace Research` and opens `/workspace/{id}/research`.
- Blank Research page shows an empty-state message and template creation controls.
- Creating template spaces displays seeded tile text for each selected template.
- Two browser contexts show the same edited tile content after collaboration sync.
- Connector-unavailable enrichment displays exact visible text `AI not connected`.
- Per-tile AI errors are visible and include exact visible action text `Re-enrich`.
- Tiling, kanban, and graph controls switch views without losing tile data.
- Synthesis panel displays generated synthesis content and a copy control.
- `.nodepad` export/import preserves project name, blocks, annotations, relationships, pins, sources, and sub-tasks.
- Markdown copy/export includes headings, grouped notes, tasks, quotes, sources, and synthesis content.
- Workspace Brain promotion displays a success message and creates a Brain document.
- Personal Brain promotion displays a success message and creates a Brain document in the personal target.
- `/editor`, workspace workflow editing, and Brain panel still open successfully.
- No nodepad OpenRouter/OpenAI/Z.ai provider-key settings UI appears.
- No nodepad localStorage-only primary persistence dependency is required for research data.

## Screenshot Capture Points
- Workspace dashboard Research entry.
- Blank Research page.
- Template-created space with seeded tiles.
- Two-browser sync state.
- AI error/retry state showing `AI not connected` and `Re-enrich`.
- Graph view.
- Synthesis panel.
- Promote menu.
- Brain document result after promotion.

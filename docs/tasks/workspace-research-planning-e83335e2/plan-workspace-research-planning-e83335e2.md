# feature: Workspace Research And Planning

## Metadata
adw_id: `e83335e2`
document_description: `Workspace Research And Planning`

## Description
The task adds a native, workspace-scoped research and planning surface to Nexus Workflow Studio. The new surface should live at `/workspace/[id]/research`, be launched from the workspace dashboard, and port the core user experience from the sibling `/media/falfaddaghi/extradrive2/repo/nodepad` clone into Nexus modules rather than hosting nodepad as a separate app.

The V1 scope is broad and includes research spaces, note tiles, local-first collaboration, AI enrichment, inferred note relationships, tiling/kanban/graph views, synthesis, `.nodepad` import/export, markdown export/copy, planning templates, and promotion into both Workspace Brain and Personal Brain targets. Data must be persisted under the existing workspace data root at `{NEXUS_BRAIN_DATA_DIR}/workspaces/{workspaceId}/research/...`, and AI must reuse the existing Nexus connector path instead of introducing nodepad-local OpenRouter/OpenAI/Z.ai settings.

Complexity assessment: `complex` because this work spans routing, dashboard UI, server persistence, schemas/types, collaboration/Yjs, AI integration, import/export, Brain promotion, package dependencies, and broad unit/E2E coverage.

## Objective
Implement a fully integrated workspace Research page that gives each Nexus workspace collaborative nodepad-like research spaces with server-backed persistence, AI-assisted enrichment/synthesis through Nexus connectors, planning templates, import/export, and Brain promotion, while preserving existing standalone `/editor`, workspace workflow editing, and Brain panel behavior.

## Problem Statement
Nexus currently centers on workflow editing and Brain documents but lacks a workspace-native surface for collecting research notes, organizing planning artifacts, collaboratively synthesizing information, and promoting curated research into the Brain. The sibling nodepad app has the desired interaction model, but running or embedding it separately would fragment routing, storage, styling, auth/connector behavior, collaboration, and data portability.

## Solution Statement
Port the relevant nodepad concepts into a first-class `research` namespace inside Nexus. Add workspace API routes and a file-backed research store mirroring the existing workspace/Brain manifest patterns. Add a client Research page composed from ported/adapted nodepad UI components styled with Nexus theme tokens. Add a research-specific Yjs/Hocuspocus adapter using stable room IDs (`nexus-research-{workspaceId}-{spaceId}`) and debounced autosave to the new API. Add AI helper modules that preserve nodepad enrichment/synthesis result shapes and robust JSON parsing while routing requests through Nexus/OpenCode connector state. Add template seeding, `.nodepad` and markdown import/export helpers, and promotion helpers that create versioned Knowledge Brain documents for workspace or personal targets.

## Code Patterns to Follow
Reference implementations:
- `CLAUDE.md` — project coding rules: use Bun, `@/*` imports, `zod/v4`, dark-theme-first UI, and preserve browser/localStorage safeguards.
- `README.md` — current app behavior, scripts, `/editor` standalone expectations, and OpenCode optional/offline behavior.
- `docs/tasks/conditional_docs.md` — conditional docs used to identify workspace and Brain documentation requirements.
- `docs/tasks/feature-workspace-foundation-616005e8/doc-feature-workspace-foundation-616005e8.md` — workspace route, server file-store, dashboard, stable room ID, and autosave conventions.
- `docs/tasks/persistent-brain/doc-persistent-brain.md` — Brain persistence, versioning, Hocuspocus, and server-backed collaboration conventions.
- `/media/falfaddaghi/extradrive2/repo/NexusWorkflowStudio/docs/spec/spec-workspace-research-planning.md` — source spec referenced by the task document. Note: this spec exists in the parent repo checkout, not in the current task tree.
- `src/lib/workspace/server.ts`, `src/lib/workspace/types.ts`, `src/lib/workspace/schemas.ts` — mirror the workspace file-store manifest pattern, nanoid usage, JSON read/write helpers, and Zod route validation.
- `src/app/api/workspaces/[id]/workflows/route.ts` and `src/app/api/workspaces/[id]/workflows/[wid]/route.ts` — follow current Next App Router route handler structure and error response style.
- `src/lib/brain/server.ts`, `src/lib/brain/client.ts`, `src/lib/brain/schemas.ts`, `src/types/knowledge.ts` — follow Brain document shape, versioned save behavior, token/session distinction, and `associatedWorkflowIds` usage for promotion.
- `src/lib/collaboration/collab-doc.ts`, `src/lib/collaboration/config.ts`, `scripts/collab-server.ts` — follow existing Hocuspocus provider, connection status, seeding, and persisted room-state patterns, but do not couple research state to workflow node/edge state.
- `src/components/workspace/dashboard.tsx`, `src/components/workspace/workspace-header.tsx`, `src/components/workspace/workflow-card.tsx`, `src/app/workspace/[id]/page.tsx` — add a dashboard Research entry consistently with current workspace UI.
- `src/components/workflow/brain-panel/*` — follow visual language and Brain document UX where promotion touches Brain.
- `src/lib/opencode/*`, `src/store/opencode/*`, `src/hooks/use-models.ts`, `src/hooks/use-tools.ts` — reuse existing Nexus connector/OpenCode state; do not port `nodepad/lib/ai-settings.ts` provider-key settings.
- Nodepad visual/functional references to port/adapt: `/media/falfaddaghi/extradrive2/repo/nodepad/app/page.tsx`, `components/project-sidebar.tsx`, `components/status-bar.tsx`, `components/vim-input.tsx`, `components/tile-card.tsx`, `components/tile-index.tsx`, `components/tiling-area.tsx`, `components/kanban-area.tsx`, `components/graph-area.tsx`, `components/ghost-panel.tsx`.
- Nodepad data/AI/export references to port/adapt: `/media/falfaddaghi/extradrive2/repo/nodepad/lib/ai-enrich.ts`, `lib/ai-ghost.ts`, `lib/content-types.ts`, `lib/detect-content-type.ts`, `lib/export.ts`, `lib/nodepad-format.ts`, `lib/initial-data.ts`.

Research notes from exhaustive greps:
- Existing Nexus workspace/Brain/OpenCode/collaboration references are spread across these files with counts and must be checked for integration impact: `src/app/api/brain/documents/route.ts` (3), `src/app/api/brain/documents/[id]/route.ts` (2), `src/app/api/brain/documents/[id]/feedback/route.ts` (2), `src/app/api/brain/documents/[id]/restore/route.ts` (2), `src/app/api/brain/documents/[id]/versions/route.ts` (2), `src/app/api/brain/documents/[id]/view/route.ts` (2), `src/app/api/brain/session/route.ts` (2), `src/components/workflow/brain-panel/constants.ts` (8), `src/components/workflow/brain-panel/doc-editor.tsx` (17), `src/components/workflow/brain-panel/panel.tsx` (7), `src/components/workflow/connect-dialog.tsx` (19), `src/components/workflow/floating-workflow-gen.tsx` (4), `src/components/workflow/generated-export-dialog.tsx` (4), `src/components/workflow/header/session-actions.tsx` (3), `src/components/workflow/header.tsx` (4), `src/components/workflow/header/use-header-controller.ts` (5), `src/components/workflow/project-switcher.tsx` (8), `src/components/workflow/shared-header-actions.tsx` (4), `src/components/workflow/workflow-editor.tsx` (4), `src/hooks/use-models.ts` (7), `src/hooks/use-tools.ts` (3), `src/hooks/use-workspace-autosave.ts` (1), `src/lib/brain/client.ts` (18), `src/lib/brain/schemas.ts` (1), `src/lib/brain/server.ts` (18), `src/lib/brain/types.ts` (7), `src/lib/collaboration/collab-doc.ts` (11), `src/lib/collaboration/config.ts` (3), `src/lib/collaboration/index.ts` (1), `src/lib/knowledge.ts` (10), `src/lib/opencode/client.ts` (4), `src/lib/opencode/config.ts` (3), `src/lib/opencode/errors.ts` (10), `src/lib/opencode/index.ts` (22), `src/lib/opencode/services/events.ts` (3), `src/lib/opencode/types.ts` (4), `src/lib/__tests__/brain-server.test.ts` (13), `src/store/knowledge/helpers.ts` (6), `src/store/knowledge/store.ts` (7), `src/store/knowledge/types.ts` (11), `src/store/opencode-store.ts` (3), `src/store/opencode/store.ts` (17), `src/types/knowledge.ts` (9).
- Nodepad-local patterns that must not be blindly ported include `localStorage`, `.nodepad`, `OpenRouter`, `OpenAI`, `Z.ai`, and `research`. The grep found relevant references in `/media/falfaddaghi/extradrive2/repo/nodepad/app/page.tsx` (22), `app/layout.tsx` (9), `components/about-panel.tsx` (18), `components/project-sidebar.tsx` (3), `components/status-bar.tsx` (2), `components/vim-input.tsx` (2), `lib/ai-settings.ts` (17), `lib/ai-enrich.ts` (7), `lib/nodepad-format.ts` (8), `lib/export.ts` (5), plus smaller references in `app/api/fetch-url/route.ts`, `components/intro-modal.tsx`, `components/mobile-wall.tsx`, `components/tiling-area.tsx`, `lib/acp-client.ts`, and `lib/ai-ghost.ts`. Use these as a checklist to remove/replace localStorage-only and provider-key behavior in the Nexus port.

## Relevant Files
Use these files to complete the task:

- `CLAUDE.md` — mandatory project conventions and validation expectations.
- `.app_config.yaml` — app configuration and default validation commands.
- `README.md` — public behavior and scripts; update if Research becomes a user-facing feature documented in the main product overview.
- `package.json` / `bun.lock` — add direct dependencies if the ported UI keeps using `d3`, `framer-motion`, `cmdk`, `react-markdown`, and `remark-gfm`; validate scripts.
- `/media/falfaddaghi/extradrive2/repo/NexusWorkflowStudio/docs/spec/spec-workspace-research-planning.md` — source spec; ensure every FR/AC remains covered.
- `docs/tasks/conditional_docs.md` — conditional documentation rules; this task matches workspace and Brain conditions.
- `docs/tasks/feature-workspace-foundation-616005e8/doc-feature-workspace-foundation-616005e8.md` — workspace architecture reference.
- `docs/tasks/persistent-brain/doc-persistent-brain.md` — Brain and collaboration architecture reference.
- `src/app/workspace/[id]/page.tsx` — existing workspace dashboard route; add navigation path to Research through the dashboard component.
- `src/components/workspace/dashboard.tsx` — add Research card/entry and dashboard affordance that opens `/workspace/${workspaceId}/research`.
- `src/components/workspace/workspace-header.tsx` — consider adding a Research tab/button if dashboard navigation belongs in the header.
- `src/app/api/workspaces/[id]/route.ts` and `src/app/api/workspaces/[id]/workflows/**` — reference route conventions and workspace existence checks.
- `src/lib/workspace/config.ts` — use the existing workspace data root under `NEXUS_BRAIN_DATA_DIR`.
- `src/lib/workspace/server.ts` — extend or complement file persistence with research-specific storage under `workspaces/{workspaceId}/research`.
- `src/lib/workspace/types.ts` — keep workspace records unchanged; research types should live in `src/lib/research/types.ts` unless a shared workspace manifest extension is required.
- `src/lib/workspace/schemas.ts` — either add research route schemas here only if workspace-local, or prefer `src/lib/research/schemas.ts` for research namespace clarity.
- `src/lib/brain/server.ts`, `src/lib/brain/client.ts`, `src/lib/brain/schemas.ts`, `src/types/knowledge.ts` — implement Workspace Brain/Personal Brain promotion through existing Knowledge document conventions.
- `src/lib/knowledge.ts`, `src/store/knowledge/store.ts`, `src/store/knowledge/types.ts` — integrate personal Brain promotion if it uses the current browser/session Brain store APIs.
- `src/lib/collaboration/collab-doc.ts`, `src/lib/collaboration/config.ts`, `src/lib/collaboration/index.ts`, `scripts/collab-server.ts` — add research room id helpers and research-specific Yjs syncing without regressing workflow/Brain collaboration.
- `src/lib/opencode/index.ts`, `src/lib/opencode/client.ts`, `src/lib/opencode/types.ts`, `src/store/opencode-store.ts`, `src/store/opencode/store.ts`, `src/components/workflow/connect-dialog.tsx` — reuse existing connector/OpenCode status and calls for research AI.
- Nodepad reference files under `/media/falfaddaghi/extradrive2/repo/nodepad/components/*` and `/media/falfaddaghi/extradrive2/repo/nodepad/lib/*` listed above — port behavior, not app-level hosting or local provider settings.

### New Files
- `src/app/workspace/[id]/research/page.tsx` — workspace Research route shell.
- `src/app/api/workspaces/[id]/research-spaces/route.ts` — `GET`/`POST` list and create research spaces.
- `src/app/api/workspaces/[id]/research-spaces/[rid]/route.ts` — `GET`/`PUT`/`PATCH`/`DELETE` single research space operations.
- `src/app/api/workspaces/[id]/research-spaces/[rid]/promote/route.ts` — promote selected research content to Workspace Brain or Personal Brain.
- `src/app/api/workspaces/[id]/research-spaces/[rid]/enrich/route.ts` — optional server-side enrichment endpoint if connector calls should not run directly from the browser.
- `src/app/api/workspaces/[id]/research-spaces/[rid]/synthesize/route.ts` — optional synthesis endpoint if implemented separately from enrichment.
- `src/components/research/research-page.tsx` — main full-screen research container.
- `src/components/research/status-bar.tsx` — compact status bar with workspace/space status, sync/AI states, and view controls.
- `src/components/research/space-sidebar.tsx` — left spaces/settings/templates/import/export panel.
- `src/components/research/command-input.tsx` — bottom command input adapted from nodepad VimInput.
- `src/components/research/tile-card.tsx` — note tile renderer with annotation, sources, errors, tasks, pinning, and `Re-enrich`.
- `src/components/research/tile-index.tsx` — index/search/filter panel.
- `src/components/research/views/tiling-view.tsx` — tiling note layout.
- `src/components/research/views/kanban-view.tsx` — kanban grouping by content type/category/status.
- `src/components/research/views/graph-view.tsx` — relationship graph view using `d3` if retained.
- `src/components/research/synthesis-panel.tsx` — generated synthesis output and copy/export controls.
- `src/components/research/promote-menu.tsx` — Workspace Brain default and Personal Brain secondary target with workflow linking.
- `src/components/research/template-picker.tsx` — Research Brief, PRD, Implementation Plan, and Decision Log template creation UI.
- `src/components/research/import-export-menu.tsx` — `.nodepad` import/export and markdown export/copy UI.
- `src/hooks/use-research-spaces.ts` — fetch/list/create/delete spaces for a workspace.
- `src/hooks/use-research-collaboration.ts` — start/stop research Yjs/Hocuspocus room, merge local/remote state, and expose connection status.
- `src/hooks/use-research-autosave.ts` — debounced snapshot saves via research API.
- `src/lib/research/types.ts` — `ResearchSpaceRecord`, `ResearchSpaceData`, `ResearchBlock`, `ResearchGhostNote`, `ResearchTemplateId`, `ResearchViewMode`, enrichment and synthesis types.
- `src/lib/research/schemas.ts` — Zod schemas using `zod/v4` for routes and import validation.
- `src/lib/research/server.ts` — file persistence under `workspaces/{workspaceId}/research/manifest.json` and `spaces/{spaceId}.json`.
- `src/lib/research/client.ts` — browser fetch helpers for the research API.
- `src/lib/research/templates.ts` — template seed data for Research Brief, PRD, Implementation Plan, Decision Log.
- `src/lib/research/nodepad-format.ts` — Nexus-adapted `.nodepad` parse/serialize helpers preserving nodepad portability.
- `src/lib/research/markdown-export.ts` — Nexus-adapted research-logical markdown export/copy helper.
- `src/lib/research/ai.ts` — enrichment/synthesis prompt construction, robust JSON parsing, and connector calls.
- `src/lib/research/content-types.ts` and `src/lib/research/detect-content-type.ts` — content-type taxonomy and local classifier adapted from nodepad.
- `src/lib/research/promotion.ts` — convert selected research content to versioned Knowledge Brain documents.
- `src/lib/research/collaboration.ts` — `buildResearchRoomId(workspaceId, spaceId)` and Yjs snapshot helpers.
- `src/store/research-store.ts` or `src/store/research/*` — client state for active space, blocks, view mode, panels, selection, AI states.
- `src/lib/__tests__/research-server.test.ts` — persistence and API helper unit tests.
- `src/lib/__tests__/research-schemas.test.ts` — schema validation tests.
- `src/lib/__tests__/research-nodepad-format.test.ts` — `.nodepad` import/export tests.
- `src/lib/__tests__/research-markdown-export.test.ts` — markdown grouping/export tests.
- `src/lib/__tests__/research-ai.test.ts` — robust JSON parsing and prompt behavior tests.
- `src/lib/__tests__/research-templates.test.ts` — planning template seed tests.
- `src/lib/__tests__/research-promotion.test.ts` — Workspace Brain/Personal Brain promotion conversion tests.
- `src/lib/__tests__/research-collaboration.test.ts` — room id, snapshot seeding, Yjs round-trip, and autosave helper tests.
- `docs/tasks/workspace-research-planning-e83335e2/e2e-workspace-research-planning-e83335e2.md` — E2E spec to be created during implementation, not during planning.

## Implementation Plan
### Phase 1: Foundation
Create the research domain model, schemas, file-backed persistence, API routes, client fetch helpers, package dependencies, and dashboard route entry. Establish a research-specific room ID and snapshot format before building UI so all components share stable types.

### Phase 2: Core Implementation
Port/adapt nodepad UI and behavior into `src/components/research` and `src/lib/research`. Implement spaces, blocks, notes, planning templates, views, index, command input, synthesis, `.nodepad`/markdown import/export, AI enrichment with visible retry/error states, and Brain promotion conversion.

### Phase 3: Integration
Wire Research into workspace routing, existing connector state, Hocuspocus collaboration, autosave, and Brain APIs. Add tests for persistence, schemas, AI parsing, import/export, templates, collaboration, and promotion. Add the separate E2E specification covering browser interactions but do not execute E2E in validation commands.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Confirm Scope, Reference Behavior, and Dependencies
- Re-read the task source JSON and the spec file at `/media/falfaddaghi/extradrive2/repo/NexusWorkflowStudio/docs/spec/spec-workspace-research-planning.md` before coding.
- Re-open `CLAUDE.md`, `README.md`, `docs/tasks/conditional_docs.md`, `docs/tasks/feature-workspace-foundation-616005e8/doc-feature-workspace-foundation-616005e8.md`, and `docs/tasks/persistent-brain/doc-persistent-brain.md`.
- Inspect the nodepad reference files in `/media/falfaddaghi/extradrive2/repo/nodepad`, especially `app/page.tsx`, `components/*`, `lib/ai-enrich.ts`, `lib/ai-ghost.ts`, `lib/export.ts`, and `lib/nodepad-format.ts`.
- Add direct package dependencies with Bun only if retained by the ported implementation: `bun add d3 framer-motion cmdk react-markdown remark-gfm`. If any are not used, do not add them.
- Do not port `nodepad/lib/ai-settings.ts` settings UI or nodepad-local provider-key storage.

### 2. Define Research Types, Schemas, and Seed Data
- Create `src/lib/research/types.ts` with at least:
  - `ResearchSpaceRecord`
  - `ResearchSpaceData`
  - `ResearchBlock`
  - `ResearchGhostNote`
  - `ResearchTemplateId`
  - `ResearchViewMode`
  - enrichment result shape containing `contentType`, `category`, `annotation`, `confidence`, `influencedByIndices`, `isUnrelated`, `mergeWithIndex`, and optional `sources`
- Include fields needed for collaboration and persistence: stable `id`, `workspaceId`, `name`, `createdAt`, `updatedAt`, `createdBy`/`lastModifiedBy`, `blocks`, `collapsedIds`, `ghostNotes`, `syntheses`, `templateId`, `associatedWorkflowIds`, and view/UI state where appropriate.
- Create `src/lib/research/schemas.ts` using `zod/v4` for create/update/save/promote/import payloads.
- Create `src/lib/research/templates.ts` with deterministic starter tiles for:
  - `research-brief`
  - `prd`
  - `implementation-plan`
  - `decision-log`
- Ensure template seed blocks are structured enough to be useful but not tied to any single workspace.

### 3. Implement File-Backed Research Persistence
- Create `src/lib/research/server.ts` modeled after `src/lib/workspace/server.ts`.
- Store data exactly under:
  - `{NEXUS_BRAIN_DATA_DIR}/workspaces/{workspaceId}/research/manifest.json`
  - `{NEXUS_BRAIN_DATA_DIR}/workspaces/{workspaceId}/research/spaces/{spaceId}.json`
- Ensure `manifest.json` tracks version, `workspaceId`, `spaces: ResearchSpaceRecord[]`, and updated timestamps.
- Add helpers:
  - `listResearchSpaces(workspaceId)`
  - `createResearchSpace(workspaceId, input)`
  - `getResearchSpace(workspaceId, spaceId)`
  - `saveResearchSpace(workspaceId, spaceId, data, lastModifiedBy)`
  - `updateResearchSpaceMeta(workspaceId, spaceId, updates)`
  - `deleteResearchSpace(workspaceId, spaceId)`
- Validate that the parent workspace exists via existing workspace helpers before creating research data.
- Make writes atomic enough for local server use by writing complete JSON snapshots and ensuring directories exist.
- Strip transient UI-only fields such as `isEnriching`, temporary status text, drag state, and local errors before saving unless errors are intentionally persisted as visible per-tile AI error state.

### 4. Add Research API Routes
- Add `src/app/api/workspaces/[id]/research-spaces/route.ts` with:
  - `GET` returning `{ spaces }`
  - `POST` accepting name/template and returning `{ space }` with status `201`
- Add `src/app/api/workspaces/[id]/research-spaces/[rid]/route.ts` with:
  - `GET` returning the full `ResearchSpaceData`
  - `PUT` saving a complete snapshot
  - `PATCH` updating metadata such as name/template/workflow links
  - `DELETE` returning `204`
- Add `src/app/api/workspaces/[id]/research-spaces/[rid]/promote/route.ts` accepting selected block/synthesis/task/source IDs, target (`workspace` default or `personal`), and optional `associatedWorkflowIds`.
- If needed for connector safety, add enrichment/synthesis API routes under the same research-space route namespace rather than calling provider details directly from UI code.
- Match the existing route style: `export const dynamic = "force-dynamic"`, `NextResponse.json`, `params: Promise<...>`, `safeParse`, `400` for validation, `404` for missing workspace/space, and `500` for unexpected failures.

### 5. Add Client API Helpers and State Store
- Create `src/lib/research/client.ts` for typed fetch wrappers around all research API routes.
- Create `src/store/research-store.ts` or a `src/store/research/` module for active space state, block operations, active view mode, panel open state, selection, synthesis state, and AI status.
- Keep store mutations local-first so note creation/editing works while AI is disconnected or failing.
- Avoid localStorage as the primary research persistence. If localStorage is used at all, limit it to safe UI preferences such as last selected view mode or panel open/closed state.

### 6. Implement Research Collaboration and Autosave
- Add `buildResearchRoomId(workspaceId, spaceId): string` returning exactly `nexus-research-{workspaceId}-{spaceId}` in `src/lib/research/collaboration.ts` or `src/lib/collaboration/index.ts`.
- Implement Yjs snapshot serialization/deserialization for research space data. Prefer a Y.Map keyed by stable block IDs plus maps/text for metadata and syntheses; keep stable block IDs as the merge target for AI results.
- Create `src/hooks/use-research-collaboration.ts` using `HocuspocusProvider` and `getCollabServerUrl()`; follow `CollabDoc` connect/disconnect/awareness patterns without reusing workflow node/edge store internals.
- Seed the room from the saved `ResearchSpaceData` only when the Yjs room is empty.
- Merge remote edits into the research store and pause local-to-remote subscribers during remote application to avoid feedback loops.
- Add `src/hooks/use-research-autosave.ts` that debounces snapshot saves to `PUT /api/workspaces/[id]/research-spaces/[rid]` and performs a best-effort final save on unload when possible.
- Ensure failed enrichment does not block collaboration; AI results merge back by stable `block.id` as ordinary collaborative state.

### 7. Port and Adapt Nodepad UI into Nexus Research Components
- Create `src/app/workspace/[id]/research/page.tsx` as a client route shell resolving `params` and rendering `ResearchPage`.
- Create `src/components/research/research-page.tsx` as the full-screen page with Nexus dark theme tokens.
- Port/adapt these nodepad UI pieces:
  - compact status bar
  - left space/settings/templates panel
  - bottom command input
  - tiling view
  - kanban view
  - graph view
  - tile index panel
  - synthesis panel
  - visible per-tile `Re-enrich` retry controls
- Preserve the nodepad layout closely while adapting class names/colors to Nexus patterns (`src/lib/theme` where useful).
- Add empty/loading/error states for no spaces, missing workspace, missing space, API failures, collaboration disconnected, and AI disconnected.
- Do not include nodepad intro/about/provider settings unless they are adapted to Nexus UX and still needed.

### 8. Add Workspace Dashboard Entry
- Update `src/components/workspace/dashboard.tsx` to show a Research entry on every workspace dashboard.
- The entry should route to `/workspace/${workspaceId}/research`.
- If the workspace has no workflows, still show the Research entry along with the existing empty state or adjust `EmptyState` so users can access Research without first creating a workflow.
- Optionally add a secondary Research tab/button in `src/components/workspace/workspace-header.tsx` if it fits existing navigation.
- Ensure existing workflow creation, workflow cards, workspace rename, and recent workspace tracking remain unchanged.

### 9. Implement Note Blocks, Relationships, Views, and Synthesis
- Implement create/edit/delete/pin/collapse operations for `ResearchBlock`.
- Add inferred relationship fields using stable block IDs, converting nodepad's `influencedByIndices` into stable IDs at merge time.
- Implement tiling, kanban, and graph views over the same collaborative block state.
- Add synthesis generation and a synthesis panel that can store multiple synthesis records in `ResearchSpaceData`.
- Ensure synthesis output can be copied/exported and promoted to Brain alongside selected notes/tasks/sources.
- Include per-block sub-task support if ported from nodepad; tasks should be eligible for Brain promotion.

### 10. Implement AI Enrichment Through Nexus Connector
- Create `src/lib/research/ai.ts` by adapting nodepad's prompt intent and robust JSON parsing.
- Preserve the enrichment result shape exactly: `contentType`, `category`, `annotation`, `confidence`, `influencedByIndices`, `isUnrelated`, `mergeWithIndex`, optional `sources`.
- Route calls through existing Nexus connector/OpenCode mechanisms. If a connector is not available, return a controlled error state such as `AI not connected` rather than blocking note creation.
- Show AI errors visibly on each tile with an explicit `Re-enrich` action.
- Keep note creation/editing/collaboration fully functional when AI is disconnected, times out, returns invalid JSON, or returns partial data.
- Add retry parsing behavior similar to nodepad's `parseEnrichResult`/`coerceLooseEnrichResult`, but do not include nodepad provider-key settings or OpenRouter/OpenAI/Z.ai-specific UI.

### 11. Implement `.nodepad` Import/Export and Markdown Export/Copy
- Create `src/lib/research/nodepad-format.ts` adapted from nodepad's `lib/nodepad-format.ts`.
- Preserve `.nodepad` compatibility with `version`, `exportedAt`, project name, blocks, collapsed IDs, ghost notes, AI annotations, connections, confidence, sources, pins, and sub-tasks.
- On import, assign fresh Nexus research space IDs and preserve stable imported block IDs only when safe; otherwise remap relationships consistently.
- Create `src/lib/research/markdown-export.ts` adapted from nodepad's research-logical grouping.
- Add UI controls for `.nodepad` import, `.nodepad` export, markdown file export, and markdown copy.
- Validate malformed imports safely and show user-visible errors.

### 12. Implement Brain Promotion
- Create `src/lib/research/promotion.ts` to convert selected tiles, syntheses, tasks, sources, template metadata, and `associatedWorkflowIds` into `KnowledgeDoc`/Brain save inputs.
- Workspace Brain must be the default target from workspace research.
- Personal Brain must be available as a secondary target in the promote menu.
- For Workspace Brain, write a versioned Brain document through existing Brain server/session patterns or a clear workspace target helper.
- For Personal Brain, use the current user/browser Brain session path without requiring workspace Brain to be selected.
- Include selected workflow links in `associatedWorkflowIds` when provided.
- Ensure promotion failures do not lose research edits and are surfaced to the user.

### 13. Add Unit and Integration Tests
- Add schema tests in `src/lib/__tests__/research-schemas.test.ts` for valid/invalid blocks, templates, save payloads, and promotion payloads.
- Add persistence tests in `src/lib/__tests__/research-server.test.ts` using a temp data dir to verify manifest creation, space CRUD, missing workspace handling, snapshot save, delete, and path layout.
- Add `.nodepad` import/export tests in `src/lib/__tests__/research-nodepad-format.test.ts` for full-fidelity round trips and malformed input.
- Add markdown export tests in `src/lib/__tests__/research-markdown-export.test.ts` for type grouping, claims/tasks/quotes, sources, and empty spaces.
- Add AI tests in `src/lib/__tests__/research-ai.test.ts` for fenced JSON, loose/truncated JSON fallback, invalid JSON errors, connector-unavailable behavior, and confidence clamping.
- Add template tests in `src/lib/__tests__/research-templates.test.ts` for all four V1 templates and deterministic starter tiles.
- Add promotion tests in `src/lib/__tests__/research-promotion.test.ts` for Workspace Brain default, Personal Brain target, selected content, syntheses, tasks, sources, template metadata, and `associatedWorkflowIds`.
- Add collaboration helper tests in `src/lib/__tests__/research-collaboration.test.ts` for exact room id generation, initial snapshot seeding, Yjs state round-trip, and autosave snapshot preparation.
- Update existing Brain/workspace/collaboration tests if shared helpers change.

### 14. Create the Separate E2E Test Specification File
- Create `docs/tasks/workspace-research-planning-e83335e2/e2e-workspace-research-planning-e83335e2.md` during implementation.
- Do not execute this E2E file in the implementation validation commands; a separate pipeline runs it.
- The E2E spec must contain these sections:
  - `User Story`: validate a workspace user can create and collaboratively use Research spaces, run/retry AI enrichment, switch views, synthesize, import/export, and promote to both Brain targets.
  - `Test Steps`: browser interactions using `playwright-cli` only, including creating a workspace, opening the Research dashboard entry, creating each required planning template at least once or using a minimal matrix, adding/editing tiles in two browser contexts, verifying live sync, triggering enrichment and `Re-enrich`, switching tiling/kanban/graph views, generating synthesis, exporting `.nodepad`, importing `.nodepad`, copying/exporting markdown, promoting to Workspace Brain and Personal Brain, and regression checks for `/editor`, workspace workflows, and Brain panel.
  - `Success Criteria`: exact UI text/values to assert, including route `/workspace/{id}/research`, visible `AI not connected` when connector unavailable, visible per-tile AI errors, visible `Re-enrich`, successful promotion messages, and no nodepad localStorage dependency.
  - `Screenshot Capture Points`: dashboard Research entry, blank Research page, template-created space, two-browser sync state, AI error/retry state, graph view, synthesis panel, promote menu, and Brain document result.

### 15. Update Documentation Where User-Facing Behavior Changes
- Update `README.md` to mention workspace Research if project maintainers expect new user-facing features to be documented there.
- If configuration changes are needed for collaboration/Brain, update `.env.example`, Docker/start scripts, and docs consistently; avoid adding new env vars unless existing `NEXUS_BRAIN_DATA_DIR`/collab vars cannot satisfy the requirement.
- Add a task summary document under this task directory after implementation if the project convention requires documenting major features.

### 16. Run Validation Commands
- Run all commands listed in the `Validation Commands` section.
- Fix every type, lint, test, and build failure before considering the task complete.
- Do not run browser/E2E commands here.

## Testing Strategy
### Unit Tests
- Research schemas validate all route payloads, block shapes, enrichment result shapes, template IDs, view modes, and promotion target values.
- Research server tests verify exact filesystem layout, manifest updates, CRUD operations, missing workspace/space behavior, safe deletes, and snapshot persistence.
- `.nodepad` import/export tests verify full-fidelity serialization, transient-state stripping, relationship preservation/remapping, name conflict handling, and invalid file errors.
- Markdown export tests verify research-logical grouping order, claims table, task lists, quote formatting, sources, front matter, and empty export behavior.
- AI parsing tests verify strict JSON, fenced JSON, loose/truncated JSON fallback, invalid JSON errors, unavailable connector state, and confidence clamping.
- Template tests verify Research Brief, PRD, Implementation Plan, and Decision Log seed the expected starter tiles.
- Promotion tests verify Workspace Brain default, Personal Brain secondary target, selected content only, syntheses/tasks/sources inclusion, template metadata, workflow associations, and versioned document creation.
- Collaboration tests verify `nexus-research-{workspaceId}-{spaceId}` room IDs, Yjs snapshot round-trip, initial seeding only into empty docs, stable block ID merging, and autosave serialization.

### Edge Cases
- Workspace does not exist when listing/creating research spaces.
- Research manifest exists but a space file is missing or malformed.
- Two clients create/edit/delete the same block while autosave is pending.
- AI connector unavailable, disconnected mid-request, times out, returns provider errors, returns invalid JSON, or returns relationship indices that no longer map to existing blocks.
- Imported `.nodepad` file has duplicate block IDs, unknown content types, missing optional fields, old/newer versions, malformed JSON, or broken relationship references.
- Markdown export of empty spaces, blocks with pipes/newlines, long annotations, missing categories, missing confidence, and source URLs with unusual characters.
- Promotion with no selected tiles, deleted selected tiles, missing Brain session, duplicate document title, invalid `associatedWorkflowIds`, and partial Brain save failure.
- Collaboration server unreachable; page should still allow local editing and show visible sync/AI states.
- Existing `/editor` standalone route, workspace workflows, workspace collaboration, and Brain panel continue to work.

## Acceptance Criteria
- Workspace dashboard includes a Research entry that opens `/workspace/[id]/research`.
- `/workspace/[id]/research` renders a native Nexus full-screen research surface, not a separately hosted nodepad app.
- Research spaces persist under `{NEXUS_BRAIN_DATA_DIR}/workspaces/{workspaceId}/research/manifest.json` and `spaces/{spaceId}.json`.
- API routes exist and work for all required methods: list/create/get/save/update/delete/promote.
- Types exist for `ResearchSpaceRecord`, `ResearchSpaceData`, `ResearchBlock`, `ResearchGhostNote`, `ResearchTemplateId`, and `ResearchViewMode`.
- Planning templates exist for Research Brief, PRD, Implementation Plan, and Decision Log, each seeding structured starter tiles.
- Research collaboration uses room IDs exactly matching `nexus-research-{workspaceId}-{spaceId}`.
- Saved snapshots seed empty Yjs rooms, collaborative edits sync live, and debounced autosave writes back through the research API.
- Tiling, kanban, and graph views render the same research space state.
- Index and synthesis panels are available in the Research page.
- AI enrichment uses Nexus connector/OpenCode paths and does not add nodepad-local OpenRouter/OpenAI/Z.ai key settings.
- Notes save and collaborate when AI is disconnected, with a visible `AI not connected` state.
- Per-tile AI errors remain visible and include an explicit `Re-enrich` action.
- Enrichment result shape preserves `contentType`, `category`, `annotation`, `confidence`, `influencedByIndices`, `isUnrelated`, `mergeWithIndex`, and optional `sources`.
- `.nodepad` import/export works for project portability.
- Markdown export/copy uses nodepad's research-logical grouping adapted to Nexus.
- Brain promotion supports Workspace Brain as the default and Personal Brain as a secondary target.
- Promotion writes a versioned Brain document including selected tiles, syntheses, tasks, sources, template metadata, and optional `associatedWorkflowIds`.
- Unit tests cover schemas, persistence, import/export, markdown export, AI parsing, template seeding, Brain promotion, and collaboration helpers.
- A separate E2E spec file is created at `docs/tasks/workspace-research-planning-e83335e2/e2e-workspace-research-planning-e83335e2.md` with the required structure and browser flow, but is not executed by validation commands.
- Regression checks confirm `/editor` standalone still works, workspace workflows still save/collaborate, Brain panel still opens, and no nodepad localStorage primary persistence dependency is introduced.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

From `.app_config.yaml` and project scripts:
- `npm run typecheck`
- `npm run lint`
- `bun run test`
- `npm run build`

Notes:
- `.app_config.yaml` provides `npm run typecheck`, `npm run lint`, and `npm run build`; `commands.test` is unset, but the task/spec and `package.json` require `bun run test` for this feature.
- No browser, Playwright, `playwright-cli`, or HTTP UI probing commands belong in this section; those belong to the separate E2E spec/pipeline.

## Notes
- Use the project harness/skills described in `CLAUDE.md` for non-trivial implementation; this task is complex and multi-file.
- Treat the sibling nodepad repository as reference/source code only. Do not iframe, proxy, start, or separately host nodepad.
- Prefer a research namespace (`src/lib/research`, `src/components/research`, `src/store/research`) to avoid coupling workflow-node code to research tiles.
- Preserve existing sanitization and validation patterns. Avoid new `any` unless isolated to compatibility parsing with follow-up typed normalization.
- Be careful with browser-only APIs (`window`, `localStorage`, `navigator.clipboard`, `Blob`, file inputs) and keep them in client components/helpers.
- Keep OpenCode/AI optional: offline research editing is a first-class path.

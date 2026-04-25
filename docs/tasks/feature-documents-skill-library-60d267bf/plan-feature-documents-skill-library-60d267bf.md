# feature: documents-skill-library

## Metadata
adw_id: `60d267bf`
issue_description: `docs/spec/spec-documents-skill-library.md` — Documents Skill Library (workspace + user-local library, packs/plugins, skills, real-time Markdown collaboration, branch/merge, publish, self-contained workflow export). See `agents/60d267bf/start-task.json`.

## Description

Nexus Workflow Studio currently has:

- a Brain document store (filesystem, signed token, version snapshots, soft-delete) at `src/lib/brain/server.ts` + `src/app/api/brain/*`
- a local library (browser localStorage) storing saved workflows and reusable nodes at `src/lib/library.ts`
- node types `Skill`, `Document`, `Prompt`, `Script` with per-node generators that emit `SKILL.md`, docs, scripts under `.opencode|.pi|.claude`
- Hocuspocus-backed real-time collaboration (`src/lib/collaboration/collab-doc.ts`) syncing both workflow canvas and Brain docs via Y.js
- a Markdown editor via `@uiw/react-md-editor` used in the Brain panel
- no database (Postgres/SQLite/Drizzle are absent from `package.json`)

The spec asks for a document-centered **library of Markdown skills** grouped into **packs/plugins**, with **workspace** and **user-local** scopes, **branch/fork** flows, **publish at pack and skill level**, **self-contained workflow export**, and **Agent Skills compatibility**. Workflows must reference skills by stable `scope + packId + packVersion + skillId`.

Because this codebase has **no relational database**, we implement metadata in the same filesystem-backed pattern used by Brain: a JSON manifest + per-record files. RustFS-style immutable object-key conventions are followed inside the filesystem so a future swap to S3/RustFS is a storage-driver change. "Workspace" here aligns with the existing Brain workspace (one per signed token).

## Objective

Deliver the MVP slice of the Documents Skill Library spec:

- workspace + user-local library packs
- file tree + Markdown document editor (real-time collab reusing Hocuspocus)
- skill folders with `SKILL.md` entrypoints
- normalized pack manifest
- validation (missing entrypoint, duplicate IDs, broken references, invalid frontmatter)
- branch/fork of a workspace pack into a user-local fork with three-way Markdown merge + conflict records
- publish pack version and publish skill version
- immutable pack-version snapshots bound to immutable document versions
- workflow Skill node references `scope + packId + packVersion + skillId` with a skill picker
- self-contained `.nexus` workflow export (zip) containing workflow definition, referenced packs/skills/documents, normalized manifests, and content hashes
- import of Nexus-native `.nexus` archives and best-effort Agent Skills folders/zips
- tests for storage, manifest building, three-way merge, publish, export/import integrity
- E2E coverage of the golden path

## Problem Statement

The editor has no way to author, version, organize, publish, or export a reusable **library of Markdown skills** that multiple workflows can reference by stable identity. Users currently duplicate skill content in every workflow, lose customizations when a base skill is updated, cannot share packs of related skills, and cannot produce a workflow export that is self-contained (the generated `SKILL.md` files live next to each workflow rather than inside a versioned, sharable pack).

## Solution Statement

Layer a **pack/skill metadata service** and a **library UI** on top of the existing Brain-style filesystem document store. Extend `src/lib/brain` into `src/lib/library-store` (backend) and a matching client. Use Hocuspocus + Y.js for live Markdown editing (one Y.Doc per library document, room name `lib:{workspaceId}:{libraryDocId}`). Add publish flows that snapshot documents into immutable version records. Update the Skill node data model to carry `scope + packId + packVersion + skillId` and resolve content through a runtime resolver that works both live and inside an exported artifact. Add a `.nexus` zip export pipeline that bundles the workflow + reachable packs.

## Code Patterns to Follow

Reference implementations in this repo:

- **Brain filesystem store** (`src/lib/brain/server.ts`) — manifest.json + per-doc + per-version files, HMAC-signed tokens, soft-delete via `deletedAt`, `createVersion()` pattern, singleton accessor. Model the new library store after this.
- **Brain API routes** (`src/app/api/brain/session/route.ts`, `src/app/api/brain/documents/**`) — token auth via `requireWorkspace()` / `getBrainTokenFromHeaders()`, JSON responses, `[id]` and nested dynamic segments. Mirror this shape under `src/app/api/library/**`.
- **Knowledge store** (`src/store/knowledge/store.ts`) — async Zustand slice that wraps the Brain API; replicate for library state.
- **Collab wiring** (`src/lib/collaboration/collab-doc.ts`) — Y.Doc + Hocuspocus provider, awareness for presence, subscribe-observe dedupe pattern. Reuse for per-document Markdown editing: add a second `CollabDoc`-style binding for `Y.Text` per library doc.
- **Node generator module** (`src/nodes/skill/generator.ts`, `src/lib/workflow-generator.ts`) — `NodeGeneratorModule.getSkillFile()` signature and `GeneratedFile[]` aggregation. Extend to route skill content through the library resolver.
- **Export paths** (`src/lib/generation-targets.ts`, `buildGeneratedSkillFilePath()`) — keep sanitization helpers; add a new target for `.nexus` archives.
- **Marketplace** (`src/lib/marketplace/index.ts`) — plugin discovery pattern; reuse `.claude-plugin/marketplace.json` parsing when importing Agent Skills folders.
- **Workflow JSON validation** (`src/lib/workflow-validation.ts`, `src/lib/workflow-schema.ts`) — Zod-v4 schema style (note: import `"zod/v4"` per project rule).
- **Library panel UI** (`src/components/workflow/library-panel/panel.tsx` + `use-library-panel-controller.ts`) — controller/view split with shadcn primitives.

## Relevant Files

Use these files to complete the task:

### Spec & guidance
- `/media/falfaddaghi/extradrive2/repo/NexusWorkflowStudio/trees/rustFS/docs/spec/spec-documents-skill-library.md` — full spec (the authoritative source).
- `/media/falfaddaghi/extradrive2/repo/NexusWorkflowStudio/trees/rustFS/rustfs-branchable-document-system.md` — branchable document substrate this feature layers on.
- `CLAUDE.md` — project rules: `@/*` alias, `zod/v4`, dark-theme, client-only storage caveats, update multiple touchpoints when changing nodes.
- `docs/tasks/persistent-brain/doc-persistent-brain.md` — prior patterns for filesystem doc store, signed tokens, version snapshots, share links. (Read because this task persists documents and extends `src/lib/brain/*`.)
- `docs/tasks/conditional_docs.md` — confirms the above doc is relevant.

### Server / storage layer (to extend)
- `src/lib/brain/server.ts` — `BrainStore`, `createVersion()`, token helpers (`requireWorkspace`, `getBrainTokenFromHeaders`, `createShareToken`). Import helpers and follow pattern.
- `src/lib/brain/types.ts`, `src/lib/brain/client.ts`, `src/lib/brain/config.ts`, `src/lib/brain/schemas.ts` — reference types and schemas.
- `src/lib/brain/__tests__/*.test.ts` — test patterns for filesystem stores.
- `src/app/api/brain/**/route.ts` — route shape (token → workspaceId → action).

### Node system (to modify)
- `src/types/node-types.ts` — node-type enum, library-saveable set.
- `src/types/workflow.ts` — node-data union (will extend `SkillNodeData`).
- `src/lib/node-registry.ts` — central registry.
- `src/nodes/skill/types.ts`, `src/nodes/skill/constants.ts`, `src/nodes/skill/fields.tsx`, `src/nodes/skill/generator.ts`, `src/nodes/skill/node.tsx`, `src/nodes/skill/index.ts`, `src/nodes/skill/script-utils.ts`.
- `src/nodes/document/types.ts`, `src/nodes/document/fields.tsx`, `src/nodes/document/generator.ts`, `src/nodes/document/utils.ts`.
- `src/nodes/prompt/types.ts` (already has `brainDocId`; model for pack reference).
- `src/components/nodes/skill-node.tsx`, `src/components/nodes/document-node.tsx` — renderers.
- `src/components/workflow/properties/type-specific-fields.tsx`, `.../skill-fields.tsx`, `.../document-fields.tsx`.
- `src/nodes/shared/registry-types.ts`.

### Generation / export (to modify)
- `src/lib/workflow-generator.ts` — add pack/skill resolution path.
- `src/lib/generation-targets.ts` — add `nexus` archive target + helpers.
- `src/lib/generated-workflow-export.ts` — folder export integration.
- `src/lib/persistence.ts` — `getWorkflowExportContent()` / `getWorkflowExportFileName()`.
- `src/lib/workflow-generation/shared.ts`, `src/lib/workflow-generation/detail-sections.ts` — shared utilities.
- `src/lib/run-script-generator.ts` — run-script emission.

### Store layer (to extend)
- `src/store/knowledge/store.ts` — async Zustand pattern.
- `src/store/workflow/store.ts`, `src/store/workflow/index.ts` — canvas store.
- `src/store/library/store.ts`, `src/store/library-store.ts` — library items (local).
- `src/store/collaboration/collab-store.ts`, `src/store/collaboration/awareness-store.ts`.

### Collaboration (to extend)
- `src/lib/collaboration/collab-doc.ts` — Y.Doc singleton and Hocuspocus wiring.
- `src/lib/collaboration/object-store.ts` — per-room persistence.
- `src/lib/collaboration/config.ts`, `src/lib/collaboration/awareness-names.ts`.
- `scripts/collab-server.ts` — Hocuspocus server.

### UI (to extend)
- `src/components/workflow/library-panel/panel.tsx`, `.../cards.tsx`, `.../constants.ts`, `.../types.ts`, `.../previews.tsx`, `.../use-library-panel-controller.ts`.
- `src/components/workflow/brain-panel/panel.tsx`, `.../doc-editor.tsx` — Markdown editor + version restore UI to mirror.
- `src/components/workflow/properties-panel.tsx` — properties host.
- `src/components/workflow/header.tsx`, `src/components/workflow/workflow-editor.tsx` — top-level wiring.
- `src/components/workflow/generated-export-dialog.tsx`, `src/components/workflow/import-dialog.tsx` — export/import UI to reuse.
- `src/components/ui/*` — shadcn primitives; do **not** hand-edit.

### Tests
- `src/lib/__tests__/brain-server.test.ts`, `src/lib/__tests__/library.test.ts`, `src/lib/__tests__/collaboration-object-store.test.ts`, `src/lib/__tests__/generation-targets.test.ts`, `src/lib/__tests__/run-script-generator.test.ts`, `src/lib/__tests__/workflow-connections.test.ts`, `src/lib/__tests__/subworkflow-transfer.test.ts`.
- `src/store/__tests__/*.test.ts`.
- `src/nodes/document/__tests__/generator.test.ts`, `.../utils.test.ts`.

### New Files

**Server / storage layer:**
- `src/lib/library-store/config.ts` — reads `NEXUS_LIBRARY_DATA_DIR` (default `./.nexus-library`), reuses `NEXUS_BRAIN_TOKEN_SECRET`.
- `src/lib/library-store/types.ts` — `LibraryScope` (`"workspace" | "user"`), `LibraryRecord`, `PackRecord`, `SkillRecord`, `LibraryDocumentRecord`, `LibraryDocumentVersionRecord`, `PackVersionRecord`, `PackVersionDocumentRecord`, `SkillVersionRecord`, `MergeRecord`, `ConflictRecord`, `LibraryManifest`.
- `src/lib/library-store/object-store.ts` — S3/RustFS-shaped key layout on the filesystem: `documents/{docId}/versions/{versionId}/content.md`, `documents/{docId}/versions/{versionId}/metadata.json`, `packs/{packId}/versions/{versionId}/manifest.json`, `exports/{exportId}/workflow-export.nexus`. Abstract `ObjectStorage` interface matching the spec.
- `src/lib/library-store/store.ts` — `LibraryStore` class with `createLibrary`, `createPack`, `forkPack`, `renamePack`, `softDeletePack`, `listPacks`, `createDocument`, `saveDocumentVersion` (with optimistic concurrency via `previousVersionId`), `listDocuments`, `softDeleteDocument`, `renameDocument`, `moveDocument`, `createSkill`, `listSkills`, `mergeBaseIntoBranch`, `resolveMergeConflict`, `publishPackVersion`, `publishSkillVersion`, `resolveLiveSkill`, `listPackVersions`, `listSkillVersions`. Mirrors `BrainStore` patterns.
- `src/lib/library-store/manifest.ts` — normalizes frontmatter+file-tree into manifest JSON (FR-38, FR-39, FR-41). Schema version `1`.
- `src/lib/library-store/merge.ts` — three-way Markdown/plain-text merge (use `diff3` style; implement inline — no new dep). Returns `{ content, conflicts[] }` matching spec conflict record shape.
- `src/lib/library-store/hashing.ts` — SHA-256 helpers; `computeContentHash`, `buildHashManifest` (for FR-65).
- `src/lib/library-store/validation.ts` — validates missing entrypoint, missing description, duplicate IDs, invalid frontmatter, broken references (FR-36, validation requirements section). Returns typed warnings.
- `src/lib/library-store/resolver.ts` — runtime resolver: `resolveLive(ref)` and `resolveFromArtifact(ref, artifact)` (see spec "Runtime Resolution").
- `src/lib/library-store/import.ts` — Nexus-native archive import + best-effort Agent Skills folder/zip import (FR-70, FR-71, FR-72).
- `src/lib/library-store/export.ts` — `.nexus` archive builder (JSZip). Gathers reachable packs, snapshots draft+published docs, writes `hashes.json`, `manifest.json`, `runtime/resolver-metadata.json`, `workflow.json`, `libraries/{scope}/packs/{packKey}/...`.
- `src/lib/library-store/schemas.ts` — Zod-v4 schemas for manifest, frontmatter, and API payloads. Use `import { z } from "zod/v4"`.
- `src/lib/library-store/index.ts` — public barrel.

**API routes (Next.js App Router) under `src/app/api/library/`:**
- `session/route.ts` — bootstrap/resume library session (reuses Brain token).
- `packs/route.ts` — GET (list by scope) / POST (create).
- `packs/[packId]/route.ts` — GET / PATCH (rename/move scope) / DELETE (soft-delete).
- `packs/[packId]/fork/route.ts` — POST (fork workspace pack into user scope).
- `packs/[packId]/merge-base/route.ts` — POST (merge base changes into fork).
- `packs/[packId]/versions/route.ts` — GET (list) / POST (publish pack version).
- `packs/[packId]/versions/[versionId]/route.ts` — GET (resolve immutable pack).
- `packs/[packId]/documents/route.ts` — GET (list) / POST (create doc).
- `packs/[packId]/documents/[docId]/route.ts` — GET / PATCH (rename/move/role) / DELETE (soft-delete).
- `packs/[packId]/documents/[docId]/versions/route.ts` — GET (list) / POST (save version; optimistic concurrency).
- `packs/[packId]/documents/[docId]/versions/[versionId]/content/route.ts` — GET (raw content).
- `packs/[packId]/skills/route.ts` — GET / POST.
- `packs/[packId]/skills/[skillId]/route.ts` — GET / PATCH / DELETE.
- `packs/[packId]/skills/[skillId]/versions/route.ts` — GET (list) / POST (publish skill version).
- `packs/[packId]/merges/[mergeId]/resolve/route.ts` — POST (submit resolution).
- `resolve/route.ts` — POST `{ scope, packId, packVersion, skillId }` → resolved skill bundle (FR-54 Live Library Mode).
- `import/route.ts` — POST multipart/form-data (accepts `.nexus` archive or Agent Skills zip).
- `export/route.ts` — POST `{ workflowJson }` → `.nexus` archive stream.

**Client / store:**
- `src/lib/library-client.ts` — typed fetch wrapper using the Brain token.
- `src/store/library-docs/store.ts` — Zustand slice for packs, skills, documents, current selection, pending merges.
- `src/store/library-docs/index.ts` — barrel.

**Collaboration:**
- `src/lib/collaboration/lib-doc-collab.ts` — per-document `Y.Text` binding to the Markdown editor. Room name `lib:{workspaceId}:{scope}:{packId}:{docId}`. On save / publish / export the server-side `LibraryStore` writes a snapshot from the current Y.js text.

**UI:**
- `src/components/workflow/documents-panel/panel.tsx` — library home: scope tabs (workspace / user-local), pack grid + search.
- `src/components/workflow/documents-panel/pack-browser.tsx` — pack list, fork, rename, archive, soft-delete, restore.
- `src/components/workflow/documents-panel/pack-detail.tsx` — four-column layout: file tree | editor | preview | skill details/validation/publish.
- `src/components/workflow/documents-panel/file-tree.tsx` — renders docs grouped by role (SKILL.md, references, docs, rules, templates, examples, assets).
- `src/components/workflow/documents-panel/doc-editor.tsx` — Markdown editor with Y.Text binding, presence, branch/base/head status badge.
- `src/components/workflow/documents-panel/markdown-preview.tsx` — rendered preview (reuse `@uiw/react-md-editor` preview component).
- `src/components/workflow/documents-panel/skill-detail-panel.tsx` — resolved skill bundle preview + validation warnings.
- `src/components/workflow/documents-panel/publish-panel.tsx` — publish pack / publish skill dialogs with diff against latest published.
- `src/components/workflow/documents-panel/branch-status-panel.tsx` — fork/branch state: clean / behind / conflict.
- `src/components/workflow/documents-panel/conflict-resolve-dialog.tsx` — per-conflict manual resolver.
- `src/components/workflow/documents-panel/import-dialog.tsx` — upload `.nexus` / Agent Skills zip.
- `src/components/workflow/documents-panel/use-documents-panel-controller.ts` — controller hook.
- `src/components/workflow/documents-panel/constants.ts`, `types.ts`, `index.ts`.
- `src/components/workflow/properties/skill-picker-dialog.tsx` — skill picker for the workflow Skill node (FR-49, FR-50).

**Types:**
- `src/types/library.ts` — shared types for `LibraryScope`, `PackRef`, `SkillRef`, `SkillBundle`, `MergeState`, `ValidationWarning`. Import from `@/types/library`.

### E2E test file (task below describes it; do NOT write it):
- `docs/tasks/feature-documents-skill-library-60d267bf/e2e-feature-documents-skill-library-60d267bf.md`

## Implementation Plan

### Phase 1: Foundation (data model + storage)

Build the metadata store, object-storage abstraction, and Zod schemas **without** UI. Provide enough API to create a library, create a pack, create a skill + doc, save document versions, publish pack + skill versions, compute hashes, list versions. Add tests for every storage primitive.

### Phase 2: Editor and collaboration

Wire the documents panel, pack browser, file tree, Markdown editor, preview, and a per-document Y.Text collab binding that shares a Hocuspocus room. Show branch/head/base status. On save → snapshot document version through the store.

### Phase 3: Skills and validation

Add skill creation (SKILL.md entrypoint), normalized manifest generation, resolved skill preview, validation panel, skill picker dialog. Wire the Skill node to reference `scope + packId + packVersion + skillId`. Add live resolver that returns a `SkillBundle`.

### Phase 4: Publishing and branch merges

Publish pack version (snapshots every document version id into `pack_version_documents`). Publish skill version (snapshots skill doc closure). Fork a workspace pack into user-local (creates branch with `base_version_id` per document). Merge-base pulls latest pack-version base content into the fork and runs three-way merge per document; conflicts get `document_merges` records and a conflict-resolution UI.

### Phase 5: Export and import

Self-contained `.nexus` zip export including `manifest.json`, `workflow.json`, `libraries/{scope}/packs/...`, `runtime/resolver-metadata.json`, `hashes.json`. Integrate with existing Generate/Export flow as a new target alongside OpenCode / PI / Claude Code, plus a new archive option. Add import for `.nexus` archives and best-effort Agent Skills folders/zips.

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### 1. Create library-store storage foundation (Phase 1, FR-13, FR-14, FR-21, FR-44, FR-45, FR-65)

- Create `src/lib/library-store/config.ts`. Read `NEXUS_LIBRARY_DATA_DIR` (default `./.nexus-library`) and reuse `NEXUS_BRAIN_TOKEN_SECRET` via `getBrainConfig()` so tokens interoperate.
- Create `src/lib/library-store/object-store.ts`. Implement the `ObjectStorage` interface from the spec (`putObject`, `getObject`, `deleteObject`, `objectExists`) with a filesystem driver anchored at the data dir. Keys follow the spec: `documents/{docId}/versions/{versionId}/content.md`, `documents/{docId}/versions/{versionId}/metadata.json`, `packs/{packId}/versions/{versionId}/manifest.json`, `exports/{exportId}/workflow-export.nexus`. Keep keys immutable — no overwrite for version objects.
- Create `src/lib/library-store/hashing.ts` with `sha256(content: string|Buffer)` (use `node:crypto`).
- Create `src/lib/library-store/types.ts` with the record types listed above. Use `"workspace" | "user"` for `LibraryScope` and allow future extension. Every record includes `deletedAt: string | null`, `createdAt`, `updatedAt`, optional `metadata`.

### 2. Create Zod schemas for manifest + API payloads (FR-37, FR-38, FR-39, FR-41)

- Create `src/lib/library-store/schemas.ts`. `import { z } from "zod/v4"` — **not** `"zod"`.
- Define `ManifestSchemaV1` matching the spec "Manifest Shape" section: `schemaVersion: 1`, `packId`, `name`, `description`, `version`, `skills` (map of `skillId → { name, description, entrypoint, documents[], rules[] }`), `docs`, `rules`, `assets`.
- Define request/response schemas for every API route (create pack, create skill, save document version, publish pack, merge-base, resolve-conflict, resolve, import, export).
- Define `SkillFrontmatterSchema` for parsing `SKILL.md` YAML frontmatter (`name`, `description`, optional `compatibility`, optional `metadata`).

### 3. Implement `LibraryStore` class (FR-1..FR-8, FR-9..FR-15, FR-30..FR-36, FR-42..FR-48)

- Create `src/lib/library-store/store.ts` modelled on `BrainStore`. Singleton via `getLibraryStore()`; `resetLibraryStoreForTests()` export.
- Manifest at `{dataDir}/manifest.json` with fields: `version: 1`, `libraries[]`, `packs[]`, `skills[]`, `documents[]`, `versions[]`, `packVersions[]`, `packVersionDocuments[]`, `skillVersions[]`, `skillVersionDocuments[]`, `branches[]`, `merges[]`, `conflicts[]`.
- Methods:
  - `createLibrary(workspaceId, scope, ownerUserId?)` — idempotent; returns existing workspace+user libraries if already present.
  - `createPack(libraryId, input)` — unique `(libraryId, packKey)`; also creates an initial base branch.
  - `forkPack(sourcePackId, targetLibraryId)` — copies pack record, copies skill + document rows, sets `base_pack_id`, `branch.base_version_id = source.current_version_id` per document.
  - `softDeletePack` / `restorePack` / `renamePack` / `movePack`.
  - `listPacks(libraryId, { includeDeleted })`.
  - `searchPacks(libraryId, query)` — FR-5; matches name/description/tags/skill metadata/document content (simple linear scan for MVP).
  - `createDocument(packId, { role, path, content, createdBy })` — stores object, creates `document`, `document_version` with `parentVersionId=null`.
  - `saveDocumentVersion(docId, { content, previousVersionId, message, createdBy })` — FR-14 optimistic concurrency: reject if `previousVersionId` does not equal current head.
  - `renameDocument` / `moveDocument` / `softDeleteDocument` / `restoreDocument`.
  - `listDocuments(packId, { includeDeleted })`.
  - `createSkill(packId, { skillKey, name, description, entrypointDocId })`.
  - `listSkills(packId)` / `softDeleteSkill` / `renameSkill`.
  - `publishPackVersion(packId, { version, createdBy })` — snapshots every current doc head into `pack_version_documents`, stores normalized `manifest.json` in RustFS-style key (`packs/{packId}/versions/{versionId}/manifest.json`), validates before committing (FR-48).
  - `publishSkillVersion(skillId, { version, createdBy, linkToLatestPackVersion })` — snapshots entrypoint doc version + closure.
  - `mergeBaseIntoBranch(packId, branchId, userId)` — runs merge per document (calls `merge.ts`). Clean merges create `document_versions`, update branch heads, write `document_merges` with `merged_cleanly`. Conflicts write `document_merges` `conflict` + `document_conflicts[]`. FR-22..FR-29.
  - `resolveMergeConflict(mergeId, { resolvedContentByDocId, resolvedBy })` — completes the merge, updates heads.
  - `resolveLive({ scope, packId, packVersion, skillId })` → `SkillBundle` (FR-54).
  - `compareDraftToPublished(packId, publishedVersionId)` — diff counts per document (FR-46).
- Every version write computes SHA-256 content hash and stores it in metadata JSON alongside the object.
- Reuse `requireWorkspace(token)` from `src/lib/brain/server.ts` to bind libraries to Brain workspace ids.

### 4. Implement three-way Markdown merge (FR-25, FR-26, FR-27, FR-29)

- Create `src/lib/library-store/merge.ts` exporting `threeWayTextMerge(ancestor, theirs, yours)` returning `{ content, conflicts }`. Implement a simple line-based diff3 algorithm (no new dep) — common lines, identical changes are auto-kept; divergent edits produce a conflict block `<<<<<<< yours ... ======= ... >>>>>>> theirs` and a structured conflict entry with `{ path, conflictType: "text_conflict", ancestor, base, branch }`.
- Unit tests (see step 15) verify clean merge, same-line conflict, identical concurrent edit, deleted-vs-edited, add-vs-add.

### 5. Implement manifest building + validation (FR-36, FR-37, FR-41, Validation Requirements section)

- Create `src/lib/library-store/manifest.ts`. `buildManifest(pack, skills, documents)` returns a `ManifestSchemaV1`-compatible object. Auto-map entrypoints, references from skill records, role-tagged documents → `docs` / `rules` / `assets`.
- Create `src/lib/library-store/validation.ts`. Exports `validatePack(pack, skills, documents)` returning `ValidationWarning[]`. Cover every bullet in the spec "Validation Requirements" section: missing skill entrypoint, invalid `SKILL.md` frontmatter, missing description, duplicate pack/skill IDs, broken relative links (scan Markdown `[text](./path.md)` and image references), missing referenced documents, manifest path mismatch, deleted docs referenced by active skills, unresolved merge conflicts, missing export metadata, hash mismatch during import/open.
- Expose frontmatter parser (`parseSkillFrontmatter(content)`) used by `createSkill` and validation.

### 6. Build API routes (FR-1..FR-48, FR-49..FR-54 subset)

- For each route under `src/app/api/library/**/route.ts`, follow the Brain route pattern: read `x-brain-token` via `getBrainTokenFromHeaders()`, call `requireWorkspace()`, validate body against the Zod schema, call `getLibraryStore().<method>()`, return JSON.
- Cover: session, packs (CRUD + fork + merge-base), documents (CRUD + versions with optimistic concurrency header `If-Match: <previousVersionId>` **or** JSON body field), skills (CRUD + versions), publish flows, resolve, import, export.
- For `POST /api/library/import` accept multipart or JSON and dispatch to `src/lib/library-store/import.ts`.
- For `POST /api/library/export` accept `{ workflowJson }`, call `src/lib/library-store/export.ts`, stream the zip back with `Content-Type: application/zip` and `Content-Disposition: attachment; filename="<sanitized-name>.nexus"`.

### 7. Update Skill node data model (FR-31, FR-49, FR-50, FR-51, FR-52)

- In `src/nodes/skill/types.ts`, extend `SkillNodeData` with optional fields:
  - `libraryRef?: { scope: "workspace" | "user"; packId: string; packVersion: string | "draft"; skillId: string } | null;`
  - Keep existing `skillName`, `description`, `promptText`, etc. as fallback for inline skills (back-compat for existing workflows).
- Update `src/nodes/skill/constants.ts` default data to `libraryRef: null`.
- Update `src/components/workflow/properties/skill-fields.tsx` to render a "Link to library skill" section that opens the new `SkillPickerDialog` (see step 12). When a library ref is set, display pack name, pack version, skill name, deprecation/soft-delete warnings, and allow "Detach" to revert to inline mode.
- Update `src/nodes/skill/generator.ts` `getSkillFile()` — when `libraryRef` is set and non-null, resolve via `resolveLive()` (live mode) or embed from the export artifact. For MVP the live resolution happens at export time; the live canvas preview still reads `libraryRef` to fetch content from the store (async) and falls back to `promptText` for offline editing.
- Update `src/nodes/skill/node.tsx` renderer to show a pack badge when `libraryRef` is present.
- Update `src/types/workflow.ts` to keep the union consistent.
- Update `src/lib/workflow-generator.ts` → `collectAgentFiles()` to accept resolved skill bundles (pass them through the generator call). For export-target generation of `.opencode|.pi|.claude`, skill content must come from the resolved skill bundle (live or pinned) when a ref is set.

### 8. Build library-docs Zustand store (FR-3, FR-7, FR-8, FR-52, FR-53)

- Create `src/store/library-docs/store.ts` with actions mirroring the API: `bootstrap()`, `listPacks(scope)`, `createPack`, `forkPack`, `loadPackDetail`, `createDocument`, `saveDocument`, `renameDocument`, `softDeleteDocument`, `createSkill`, `publishPack`, `publishSkill`, `mergeBase`, `resolveConflict`, `resolveLiveSkill`.
- Track `pendingMerges` and `fork behind base` flags per pack.
- Subscribe to `useKnowledgeStore` session token to authenticate requests.

### 9. Wire per-document Y.js collab binding (FR-10, FR-16..FR-21)

- Create `src/lib/collaboration/lib-doc-collab.ts` exporting `openLibraryDocRoom(workspaceId, scope, packId, docId)` which returns `{ provider, yText, destroy }`. Room name: `lib:{workspaceId}:{scope}:{packId}:{docId}`. Reuse `getCollabServerUrl()` and `HocuspocusProvider`.
- Hocuspocus already persists arbitrary room state through `src/lib/collaboration/object-store.ts`; no server changes required unless debounce tuning is needed for Markdown editing (keep current 1000 ms default).
- When the document editor mounts, open the room; bind the MD editor's controlled value to `yText`. On "Save snapshot" (explicit button or 5-second idle), take the current `yText.toString()` and POST to `/api/library/packs/.../documents/.../versions` with `previousVersionId` from the last-known head. On success update the head in the store and show the new version in the version history list.
- Broadcast editing presence via awareness (reuse `getOrCreateUserName`, color generator). FR-19.

### 10. Build Documents panel UI (FR-9, FR-11, FR-12, FR-15, FR-34, FR-35)

- Create `src/components/workflow/documents-panel/` per the New Files list. Follow the pattern of `library-panel/` (controller hook + view components, shadcn primitives, dark-theme tokens from `src/lib/theme.ts`).
- Panel layout per spec: `[ Library / Packs ] [ File Tree ] [ Editor / Preview ] [ Skill Details / Validation ]`.
- Editor reuses `@uiw/react-md-editor` (already in deps) with Y.Text binding.
- File tree groups by document role (skill entrypoint, references, docs, rules, examples, templates, manifests, assets) — FR-12.
- Show per-document status: branch name, base version id (short), head version id (short), "clean / behind / conflict" badge — FR-15.
- Add/Rename/Move/Soft-delete/Restore document actions — FR-11.
- Markdown preview and resolved skill preview (use `resolver.resolveLive()`).

### 11. Build library home + pack browser (FR-1..FR-7)

- `documents-panel/panel.tsx`: scope tabs (Workspace / User-local), pack grid (reuse `library-panel/cards.tsx` visual patterns). "New pack" button opens a dialog.
- `pack-browser.tsx`: search input (FR-5), fork button on workspace packs (FR-6), "behind base" badge on forked packs (FR-7), soft-delete + restore affordances.
- `pack-detail.tsx`: opens `pack-detail` view hosting the four-column layout.

### 12. Build skill picker + workflow Skill node wiring (FR-49, FR-50)

- Create `src/components/workflow/properties/skill-picker-dialog.tsx` — a Radix `<Dialog>` listing packs (grouped by scope), skills per pack, version dropdown (`draft` + published semver list). Selecting a skill writes `libraryRef` onto the Skill node and closes the dialog.
- Emit warnings on the node when the referenced pack/skill is soft-deleted/deprecated — FR-52.
- Update `src/components/workflow/properties/skill-fields.tsx` to add a "Library reference" section above the inline fields.

### 13. Build validation panel (FR-36, FR-52)

- `skill-detail-panel.tsx` shows `ValidationWarning[]` from `validatePack()`. Warnings re-run on every document save.

### 14. Build publish UI (FR-42, FR-43, FR-46, FR-47, FR-48)

- `publish-panel.tsx`:
  - "Publish pack version" dialog: version string input (enforce semver regex via Zod), diff summary against latest published version (FR-46), validation must be clean before submit (FR-48).
  - "Publish skill version" dialog: similar.
  - List of published versions with badges for deprecated/soft-deleted; allow deprecate / undeprecate / soft-delete (FR-47).

### 15. Build branch / fork / merge UI (FR-6, FR-7, FR-8, FR-22..FR-29)

- `branch-status-panel.tsx` surfaces base pack version, branch head, and the "behind / clean / conflict" state computed by `store.getForkState(packId)`.
- "Merge latest base" button calls `mergeBase`.
- `conflict-resolve-dialog.tsx` renders each `document_conflicts` row with three side-by-side columns (ancestor, base, branch) and an editable resolution textarea; on submit call `resolveMergeConflict` with `{ resolvedContentByDocId }`.

### 16. Build export pipeline (.nexus archive) (FR-55..FR-67)

- Create `src/lib/library-store/export.ts`. Build a JSZip archive:
  - `manifest.json` — top-level archive manifest: `{ schemaVersion: 1, workflowName, createdAt, createdBy, packs[], skills[], resolverMode }`.
  - `workflow.json` — normalized workflow JSON (FR-56).
  - `libraries/{scope}/packs/{packKey}/manifest.json` — normalized pack manifest (FR-58, FR-59, FR-61).
  - `libraries/{scope}/packs/{packKey}/skills/{skillKey}/SKILL.md` — entrypoint doc content at export time.
  - `libraries/{scope}/packs/{packKey}/docs/**` and `rules/**`, `assets/**` — referenced content (FR-57, FR-60).
  - `runtime/resolver-metadata.json` — map `{ scope, packId, packVersion, skillId } → artifact path`, including content-hash references (FR-61).
  - `hashes.json` — map path → sha256 (FR-65).
- Traversal: for each Skill node with `libraryRef`, walk pack manifest to include every referenced document + pack-level docs/rules/assets needed by the skill. Snapshot drafts at current head; snapshot published versions at their version ID (FR-63, FR-64).
- Integrity validation step before returning the archive (FR-66).
- Add `buildGeneratedArchiveFilePath(workflowName)` helper to `src/lib/generation-targets.ts`.
- Hook into the existing export dialog (`generated-export-dialog.tsx`) as a new archive option beside OpenCode / PI / Claude Code.

### 17. Build import pipeline (FR-68..FR-72)

- `src/lib/library-store/import.ts`:
  - `importNexusArchive(buffer)` — validates `manifest.json` schema, re-hashes every file against `hashes.json` (FR-67), imports packs into the current workspace library, preserving `packKey`/`skillKey`. Collisions prompt for rename or merge (MVP: rename with `-imported-{n}`).
  - `importAgentSkillsFolder(buffer)` — best-effort: for each `SKILL.md` found, create a skill + document; parse frontmatter; include sibling `references/**` etc. Sets pack provenance flag `external: true` (Security Requirements section).
- `POST /api/library/import` route accepts multipart file uploads and dispatches.
- Add `import-dialog.tsx` hooking the UI up.

### 18. Add Brain / Hocuspocus integration to collab-doc.ts (FR-17, FR-18)

- Extend `src/lib/collaboration/collab-doc.ts` OR create a sibling for library docs (prefer sibling to keep single-responsibility). Rooms are per-document (many small rooms) vs. the single workflow room.
- No server change required — Hocuspocus server is generic (`scripts/collab-server.ts`).

### 19. Deprecate/migrate overlap with Brain "documents" (optional, but clarify)

- Existing Brain documents stay under `/api/brain`. The library is a new, parallel system. The `Prompt` and `Document` nodes retain their `brainDocId` field for existing users.
- Add a migration helper `src/lib/library-store/brain-migration.ts` that offers a one-click "Import Brain docs into user library" button in the Documents panel (optional MVP polish; leave a TODO note if time-boxed out).

### 20. Add workspace env + startup wiring

- Update `.env.example` with `NEXUS_LIBRARY_DATA_DIR=.nexus-library`.
- Update `scripts/start.sh` if it predefines Brain/collab dirs — mirror for library dir. Otherwise rely on defaults.
- Update `.gitignore` to add `.nexus-library/`.
- Update `Dockerfile` / `docker-compose.yml` if they mount Brain/collab dirs — add `.nexus-library` volume.

### 21. Write storage tests (Phase 1 deliverable; repeat extending through Phase 4)

- `src/lib/__tests__/library-store.test.ts`:
  - Create workspace + user libraries (FR-1, FR-2).
  - Create/list/soft-delete/restore pack (FR-3, FR-4).
  - Create two skills + shared doc (AC-1).
  - Save doc version rejects on stale `previousVersionId` (FR-14).
  - Fork pack copies rows and sets `base_version_id` (FR-6, AC-2).
  - Merge base into fork with no conflicts (AC-5).
  - Merge base with same-line conflict produces `document_merges` + `document_conflicts` (AC-6).
  - Resolve conflict updates branch head (FR-27).
  - Publish pack version snapshots current doc heads (FR-42, AC-7).
  - Publish skill version snapshots entrypoint closure (FR-43, AC-8).
  - Soft-delete published version remains resolvable (FR-47, AC-12 precondition).
- `src/lib/__tests__/library-merge.test.ts` covers diff3 edge cases.
- `src/lib/__tests__/library-validation.test.ts` covers every rule in the Validation Requirements list (FR-36).
- `src/lib/__tests__/library-export.test.ts`:
  - Builds a `.nexus` archive containing workflow + packs + hashes.
  - Hash validation round-trip (FR-65, FR-66, AC-10).
  - Resolver works against artifact without live library (AC-11, FR-62).
- `src/lib/__tests__/library-import.test.ts`:
  - Round-trip Nexus-native export + import (FR-68, FR-70).
  - Best-effort Agent Skills zip with single `SKILL.md` (FR-71, FR-72).
- `src/lib/__tests__/library-resolver.test.ts`:
  - Live resolution of a draft pack returns current head content.
  - Live resolution of a pinned published version ignores subsequent draft edits.

### 22. Write store tests

- `src/store/__tests__/library-docs.test.ts`:
  - `listPacks` populates state.
  - `saveDocument` marks version history.
  - `mergeBase` updates pending conflicts.
  - Skill picker selection updates workflow node data.

### 23. Write node generator test updates

- Update `src/nodes/skill/__tests__/generator.test.ts` (create if missing under `src/nodes/skill/`):
  - With no `libraryRef`, output matches existing inline behavior.
  - With `libraryRef` and a resolved bundle, output uses pack-content Markdown and frontmatter.
  - Deprecated/soft-deleted ref emits a warning path in generation log (non-fatal).

### 24. Describe E2E test file (do NOT create)

Describe `docs/tasks/feature-documents-skill-library-60d267bf/e2e-feature-documents-skill-library-60d267bf.md` with:

- **User Story** — "As a workspace user, I can create a pack with two skills, fork it into my user-local library, edit a skill in real-time with a collaborator, publish a pack version, reference that skill in a workflow, and export a self-contained `.nexus` archive that resolves skill content offline."
- **Test Steps** (playwright-cli):
  1. Open app at `http://localhost:3000` (screenshot).
  2. Open Documents panel from header toolbar (screenshot: empty workspace library).
  3. Click "New pack", enter `customer-support`, create (screenshot: pack detail view).
  4. Create skill `support-triage` with description "Classifies support requests." (screenshot: SKILL.md editor).
  5. Edit `SKILL.md` to contain `# Support Triage\nInitial instructions.`, save (screenshot: version history row appears).
  6. Add supporting document `references/escalation-policy.md` (screenshot: file tree shows two docs).
  7. Publish pack version `1.0.0` (screenshot: publish success toast; published list entry).
  8. Fork pack to user-local library (screenshot: user-local tab shows forked pack with "cleanly derived from workspace 1.0.0" badge).
  9. Back in workspace pack: edit `SKILL.md` to append `\nAdded v1.1 guidance.`, save, publish `1.1.0`.
  10. Switch to user-local fork, click "Merge latest base", expect clean merge (screenshot: merged doc contains appended text).
  11. Open a workflow, place a Skill node, open skill picker, select `workspace / customer-support / support-triage @ 1.1.0` (screenshot: Skill node shows pack badge).
  12. Open "Generate / Export" dialog, choose "Nexus archive", click export, capture download (screenshot: dialog showing archive summary).
  13. Open the resulting `.nexus` via the import dialog in a fresh workspace (or a simulated one), confirm the skill resolves with the saved content (screenshot: resolved skill preview).
- **Success Criteria**:
  - Pack and skill appear with the exact names above.
  - Published versions list contains `1.0.0` and `1.1.0`.
  - Forked pack shows "behind base" before merge and "in sync" after.
  - Workflow Skill node displays pack `customer-support @ 1.1.0`.
  - Exported archive contains `workflow.json`, `libraries/workspace/packs/customer-support/skills/support-triage/SKILL.md`, `hashes.json`, `runtime/resolver-metadata.json`.
  - Re-importing the archive reproduces the skill content byte-for-byte (hash match).
- **Screenshot capture points** — as listed at every numbered step.

### 25. Update README and CLAUDE-style quickstart

- Extend `README.md` with a new "Documents Skill Library" section summarizing workspace + user-local packs, publish, fork/merge, and `.nexus` export.
- Update `CLAUDE.md` if the node count changes (it currently says "more than 11 nodes"; new node types are not added, just new node data fields — double-check wording).
- Update `docs/tasks/conditional_docs.md` to add a condition pointing to a new doc `docs/tasks/documents-skill-library/doc-documents-skill-library.md` (write the doc as a short "what was built" summary mirroring the Brain doc).

### 26. Validation pass

- Run the `Validation Commands` below; fix any failure before closing.

## Testing Strategy

### Unit Tests

- **Storage**: `library-store.test.ts` — all pack / skill / doc / version CRUD, soft-delete, optimistic concurrency rejection, publish semantics, branch/merge, conflict resolution.
- **Merge**: `library-merge.test.ts` — diff3 clean/same-line conflict/add-add/delete-edit/trailing-newline cases.
- **Validation**: `library-validation.test.ts` — all Validation Requirements entries.
- **Export/Import**: `library-export.test.ts`, `library-import.test.ts` — round-trip Nexus-native, hash mismatches rejected, Agent Skills best-effort import.
- **Resolver**: `library-resolver.test.ts` — live (draft head) vs. pinned published behavior; artifact-mode resolution.
- **Schemas**: manifest + API payload Zod schemas round-trip.
- **Skill node generator**: library-ref path writes SKILL.md from resolved bundle; inline path unchanged.

### Edge Cases

- Optimistic concurrency: two clients saving to the same document — second must receive a stale-head rejection.
- Pack-level merge where half the documents merge cleanly and half conflict — merge record must aggregate (FR-28).
- Soft-deleted published version: already-exported artifact still resolves (AC-12).
- Draft pack reference in workflow export: content snapshots at export time (FR-63), live edits after export do not affect the artifact.
- Forking a pack whose base is also forked (two-step derivation).
- Importing a pack with duplicate `packKey` — rename with suffix.
- Agent Skills folder with missing frontmatter — creates skill with placeholder description and emits a validation warning.
- Large document (> 1 MB) — streaming save (no explicit size cap per PD-8).
- Content hash mismatch during import — reject with clear error (FR-67).
- Skill node references a pack version that no longer exists — generator emits inline placeholder + warning, not a crash.
- Y.js save when Hocuspocus is offline: queue locally via `localStorage`, flush on reconnect.

## Acceptance Criteria

Every spec AC must be covered. Each bullet below is a pass/fail criterion.

- **AC-1**: A workspace user can create a pack with two skills and shared docs. Verified by: Documents panel manual flow + `library-store.test.ts::createPackWithTwoSkills`.
- **AC-2**: A user can fork that pack into their user-local library. Verified by: fork button + `library-store.test.ts::forkPack`.
- **AC-3**: Two users can edit the same Markdown document in real time. Verified by: E2E + manual browser test with two tabs using Hocuspocus-backed `Y.Text`.
- **AC-4**: Saving creates immutable document versions backed by the filesystem object store (RustFS-compatible key layout). Verified by: `library-store.test.ts::versionSnapshot` asserts file presence under `documents/{id}/versions/{v}/content.md`.
- **AC-5**: A workspace pack update can be merged into a user-local fork. Verified by: `library-store.test.ts::mergeBaseClean`.
- **AC-6**: A conflicting Markdown edit creates a conflict record instead of overwriting. Verified by: `library-merge.test.ts::sameLineConflict` + `library-store.test.ts::mergeBaseConflict`.
- **AC-7**: A pack version can be published and later resolved by workflow nodes. Verified by: `library-store.test.ts::publishPackThenResolve`.
- **AC-8**: An individual skill version can be published and resolved. Verified by: `library-store.test.ts::publishSkillThenResolve`.
- **AC-9**: A workflow node can reference `scope + packVersion + skillId`. Verified by: Skill node type + generator tests + skill picker UI.
- **AC-10**: A workflow export includes all required documents, skills, packs, metadata, assets, and hashes. Verified by: `library-export.test.ts::fullArchiveContents`.
- **AC-11**: The exported artifact can resolve skill references without access to the live library. Verified by: `library-export.test.ts::resolveFromArtifactWithoutStore` (no network / store calls).
- **AC-12**: Soft-deleting a live document or version does not break an already-exported workflow artifact. Verified by: `library-export.test.ts::softDeleteAfterExport`.

Additional acceptance:

- `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build` all pass.
- No new `any` usage outside of documented cast patterns.
- All Zod imports use `"zod/v4"`.
- Dark-theme shadcn primitives reused; no hand-edits to `src/components/ui/`.
- `.nexus-library/` added to `.gitignore`.
- Documents panel opens without an active OpenCode connection (FR editor must work offline, per CLAUDE.md "offline/editor-only flows").

## Validation Commands

Execute every command to validate the work is complete with zero regressions.

- `bun run typecheck` — TypeScript strict check.
- `bun run lint` — ESLint (`--max-warnings=0`).
- `bun run test` — full Bun test suite.
- `bun run test:lib` — focused lib tests (fast signal while iterating).
- `bun run test:store` — focused store tests.
- `bun run test:nodes` — node generator + utility tests.
- `bun run build` — Next.js production build (wiring / route / export regressions surface here).
- Manual smoke (in browser at `http://localhost:3000`):
  - Start both servers: `bun run collab:server` and `bun run dev`.
  - Open Documents panel → create workspace pack → create skill → edit `SKILL.md` → save → see new version row.
  - Fork pack → edit base → merge clean into fork.
  - Publish pack version `1.0.0` → reference in Skill node → export `.nexus` archive → re-import → confirm resolved skill matches.

## Notes

- **No database in this repo.** The spec suggests Postgres tables; we persist the same semantic schema in a single JSON manifest plus per-record files under `.nexus-library/`. Downstream swap to Postgres is a storage-driver change.
- **RustFS substitution.** The repo name suggests a future swap from filesystem to RustFS/S3. Keep `object-store.ts` behind an `ObjectStorage` interface so a replacement driver is a one-file change.
- **Auth parity with Brain.** Library sessions reuse the Brain workspace id + HMAC token so share links and presence work with existing token plumbing.
- **`.nexus` extension is provisional** — spec open question 7. Expose a helper so the extension can be changed in one place.
- **Agent Skills style.** `SKILL.md` frontmatter remains compatible with existing generated output (`name`, `description`, `compatibility`, `metadata`) — keep the same frontmatter keys the current skill generator produces.
- **Draft reference in live workflow** (FR-51, PD-6) requires the resolver to read current heads; leave a comment in the resolver noting that exports always snapshot (FR-63) so production runs are deterministic.
- **No executable scripts at runtime** (spec Security Requirements; Non-Goals). Scripts are stored as documents with role `asset` or `script` but are not executed by this feature.
- **Complexity classification: complex.** All phased sections above are included. If scope pressure arises, the hard-to-defer set is: data model, minimal UI, publish, and export — these are the AC spine (AC-1, 4, 7, 9, 10, 11). Branch/merge (AC-2, 5, 6) and user-local library are required by the MVP scope section and should not be deferred.

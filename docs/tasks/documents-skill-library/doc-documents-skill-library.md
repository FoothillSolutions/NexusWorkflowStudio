# Documents Skill Library

## What was built

A new layer on top of the existing Brain-style filesystem document store that
manages **versioned packs of Markdown skills** with workspace and user-local
scopes, branch/fork flows, three-way Markdown merge, publish at pack and skill
granularity, immutable pack-version snapshots, a self-contained `.nexus`
workflow export, and best-effort Agent Skills compatibility.

## Where things live

### Server / storage layer
- `src/lib/library-store/config.ts` — reads `NEXUS_LIBRARY_DATA_DIR` (default
  `./.nexus-library`); reuses `NEXUS_BRAIN_TOKEN_SECRET` for auth parity.
- `src/lib/library-store/types.ts` — record types
  (`LibraryRecord`, `PackRecord`, `SkillRecord`, `LibraryDocumentRecord`,
  `LibraryDocumentVersionRecord`, `PackVersionRecord`, `SkillVersionRecord`,
  `BranchRecord`, `MergeRecord`, `ConflictRecord`, `LibraryManifest`,
  `SkillBundle`, `ValidationWarning`).
- `src/lib/library-store/object-store.ts` — `ObjectStorage` interface +
  `FilesystemObjectStorage` driver. Keys follow the spec layout:
  `documents/{docId}/versions/{versionId}/content.md`,
  `documents/{docId}/versions/{versionId}/metadata.json`,
  `packs/{packId}/versions/{versionId}/manifest.json`,
  `exports/{exportId}/workflow-export.nexus`.
- `src/lib/library-store/store.ts` — `LibraryStore` singleton with
  `ensureLibraries`, `createPack`, `forkPack`, `softDeletePack`, `restorePack`,
  `renamePack`, `searchPacks`, `createDocument`,
  `saveDocumentVersion` (optimistic concurrency via `previousVersionId`),
  `softDeleteDocument`, `createSkill`, `softDeleteSkill`, `publishPackVersion`,
  `publishSkillVersion`, `mergeBaseIntoBranch`, `resolveMergeConflict`,
  `resolveLive`, `compareDraftToPublished`, etc.
- `src/lib/library-store/manifest.ts` — `buildManifest()` emits the normalized
  `ManifestSchemaV1` shape.
- `src/lib/library-store/merge.ts` — `threeWayTextMerge()` (no extra deps).
- `src/lib/library-store/validation.ts` — `validatePack()`,
  `parseFrontmatter()`, `parseSkillFrontmatter()`.
- `src/lib/library-store/hashing.ts` — `sha256`, `computeContentHash`,
  `buildHashManifest`.
- `src/lib/library-store/resolver.ts` — `resolveLive` and
  `resolveFromArtifact` (for read-only resolution from a `.nexus` archive).
- `src/lib/library-store/export.ts` — `buildNexusArchive(workflowJson, …)`
  walks the workflow for `libraryRef` references, snapshots each reachable pack
  + skill + reference document into a JSZip archive, writes `manifest.json`,
  `workflow.json`, `runtime/resolver-metadata.json`, and `hashes.json`.
- `src/lib/library-store/import.ts` — `importNexusArchive(buffer)` (verifies
  every file's SHA-256 against `hashes.json` before importing) and
  `importAgentSkillsFolder(buffer)` (best-effort).
- `src/lib/library-store/brain-migration.ts` — `migrateBrainDocsToUserLibrary`
  helper that imports existing Brain docs into a new library pack.
- `src/lib/library-store/schemas.ts` — Zod-v4 schemas for manifest, frontmatter,
  and every API payload.

### API routes
Every route lives under `src/app/api/library/**/route.ts` and follows the
existing Brain-route pattern (token auth via `requireWorkspace`,
JSON in/out). Endpoints:
- `POST /api/library/session` — bootstrap or resume a library session
- `GET|POST /api/library/packs` — list / create
- `GET|PATCH|DELETE /api/library/packs/[packId]` — get / rename / soft-delete
- `POST /api/library/packs/[packId]/fork`
- `POST /api/library/packs/[packId]/merge-base`
- `GET|POST /api/library/packs/[packId]/versions`
- `GET /api/library/packs/[packId]/versions/[versionId]`
- `GET|POST /api/library/packs/[packId]/documents`
- `GET|PATCH|DELETE /api/library/packs/[packId]/documents/[docId]`
- `GET|POST /api/library/packs/[packId]/documents/[docId]/versions`
- `GET /api/library/packs/[packId]/documents/[docId]/versions/[versionId]/content`
- `GET|POST /api/library/packs/[packId]/skills`
- `GET|PATCH|DELETE /api/library/packs/[packId]/skills/[skillId]`
- `GET|POST /api/library/packs/[packId]/skills/[skillId]/versions`
- `GET|POST /api/library/packs/[packId]/merges/[mergeId]/resolve`
- `POST /api/library/resolve`
- `POST /api/library/import` (multipart form: file, format, scope)
- `POST /api/library/export` — streams a `.nexus` zip back

### Client
- `src/lib/library-client.ts` — typed fetch wrappers around the API routes.
- `src/store/library-docs/store.ts` — Zustand store (`useLibraryDocsStore`)
  exposing async actions matching the API surface plus pending-merge bookkeeping.

### Collaboration
- `src/lib/collaboration/lib-doc-collab.ts` — `openLibraryDocRoom()` opens a
  Hocuspocus room per library document with room name
  `lib:{workspaceId}:{scope}:{packId}:{docId}` and binds a single `Y.Text`
  (`content`).

### UI
- `src/components/workflow/documents-panel/` — entire panel:
  `panel.tsx`, `pack-browser.tsx`, `pack-detail.tsx`, `file-tree.tsx`,
  `doc-editor.tsx`, `markdown-preview.tsx`, `skill-detail-panel.tsx`,
  `publish-panel.tsx`, `branch-status-panel.tsx`,
  `conflict-resolve-dialog.tsx`, `import-dialog.tsx`, plus
  `use-documents-panel-controller.ts`, `constants.ts`, `types.ts`, `index.ts`.
- `src/components/workflow/properties/skill-picker-dialog.tsx` — Skill picker
  dialog + `LibraryRefSection` used by the Skill node properties form.
- `src/components/workflow/header/session-actions.tsx` — adds a **Library**
  button that dispatches `nexus:toggle-documents-panel`.
- `src/components/workflow/workflow-editor.tsx` — mounts `DocumentsPanel` and
  listens for the toggle event.
- `src/components/workflow/generated-export-dialog.tsx` — adds a **Download
  .nexus archive** action alongside the ZIP and folder export actions.

### Skill node updates
- `src/types/workflow.ts` and `src/nodes/skill/types.ts` add a
  `libraryRef: { scope, packId, packKey?, packVersion, skillId, skillKey?, skillName? } | null`
  field.
- `src/nodes/skill/constants.ts` updates the default data and Zod schema to
  include `libraryRef`.
- `src/nodes/skill/fields.tsx` adds a Library Reference section above the
  inline fields.
- `src/nodes/skill/generator.ts` accepts an optional `resolvedBundle` and emits
  the bundle's entrypoint content when a `libraryRef` is set.
- `src/nodes/skill/node.tsx` shows a pack badge when `libraryRef` is present.

### Tests
- `src/lib/__tests__/library-store.test.ts` — full store test (AC-1..AC-8 spine).
- `src/lib/__tests__/library-merge.test.ts` — three-way merge edge cases.
- `src/lib/__tests__/library-validation.test.ts` — every Validation Requirements rule.
- `src/lib/__tests__/library-export.test.ts` — `.nexus` archive contents,
  hash round-trip, artifact-only resolution (AC-10, AC-11).
- `src/lib/__tests__/library-import.test.ts` — round-trip + hash mismatch.
- `src/lib/__tests__/library-resolver.test.ts` — draft vs pinned semantics.
- `src/store/__tests__/library-docs.test.ts` — store smoke test.
- `src/nodes/skill/__tests__/generator.test.ts` — inline + library-ref paths.

### Configuration
- `.env.example` — adds `NEXUS_LIBRARY_DATA_DIR`.
- `.gitignore` — ignores `.nexus-library/`.
- `scripts/start.sh` — provisions the library data dir alongside Brain/collab.
- `docker-compose.yml` — adds `nexus_library_data` volume mounted at
  `/data/library` with `NEXUS_LIBRARY_DATA_DIR` env.

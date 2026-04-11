# feature: Generic File Storage

## Metadata
adw_id: `b8dbb4a6`
issue_description: `Generic file storage — the file backing should be generic and allow for multiple different file storages. S3, SharePoint, Azure Blob, etc. Make sure there is an easy way to implement and extend the existing file storage.`

## Description
The Nexus Workflow Studio server-side persistence currently uses direct Node.js `fs` calls for all storage operations — workspaces, workflows, snapshots, brain documents, and collaboration state. There is no abstraction layer, making it impossible to swap the backing store to S3, Azure Blob Storage, SharePoint, or any other provider without rewriting every call site.

This feature introduces a `StorageProvider` interface that abstracts file read/write/list/delete operations, a local filesystem implementation that preserves current behavior, and a provider registry with configuration-driven selection. All existing server-side storage consumers will be migrated to use the new abstraction.

## Objective
When complete, all server-side file I/O will flow through a pluggable `StorageProvider` interface. The local filesystem provider will be the default. Adding a new storage backend (e.g., S3, Azure Blob) will require only implementing the interface and registering the provider — no changes to workspace, brain, snapshot, or collaboration code.

## Problem Statement
Every server-side module (`workspace/server.ts`, `brain/server.ts`, `workspace/snapshots.ts`, `collaboration/object-store.ts`) imports `node:fs/promises` directly and builds file paths with `node:path`. This tight coupling means:
- Switching to cloud storage requires rewriting dozens of call sites
- Testing storage behavior requires a real filesystem
- There is no way to add cross-cutting concerns (logging, metrics, encryption) without modifying every consumer

## Solution Statement
Introduce a layered abstraction:
1. A `StorageProvider` interface with operations: `read`, `write`, `delete`, `list`, `exists`, `stat`
2. A `LocalFilesystemProvider` that wraps current `fs` logic (zero behavior change)
3. A provider factory/registry that selects the active provider based on configuration (`NEXUS_STORAGE_PROVIDER` env var)
4. Migrate all server-side consumers to obtain storage through the factory instead of importing `fs` directly
5. Provide a clear pattern for adding new providers (documented interface + registration)

## Code Patterns to Follow
Reference implementations:
- `src/lib/workspace/config.ts` — env-var-driven config with cached singleton pattern
- `src/lib/collaboration/object-store.ts` — closest existing abstraction (constructor-injected `dataDir`, `load`/`store` methods)
- `src/lib/workspace/server.ts` — helper patterns: `readJsonFile`, `writeJsonFile`, `ensureDir`, atomic writes
- `src/lib/brain/server.ts` — same helper patterns, shows the duplication that the abstraction will eliminate

## Relevant Files
Use these files to complete the task:

### Existing Files to Modify

- **`src/lib/workspace/server.ts`** — Primary workspace/workflow CRUD; currently imports `fs` directly. All `readJsonFile`/`writeJsonFile`/`ensureDir`/`fs.unlink`/`fs.readdir`/`fs.rm`/`fs.access` calls must be replaced with `StorageProvider` methods.
- **`src/lib/workspace/snapshots.ts`** — Snapshot read/write/list; uses `fs.mkdir`, `fs.writeFile`, `fs.rename`, `fs.readFile`, `fs.readdir`. Must migrate to provider.
- **`src/lib/workspace/config.ts`** — Workspace config; will be updated to expose storage provider selection.
- **`src/lib/brain/server.ts`** — Brain document persistence; duplicates `readJsonFile`/`writeJsonFile`/`ensureDir` from workspace. Must migrate to provider.
- **`src/lib/brain/config.ts`** — Brain config; will be updated for storage provider selection.
- **`src/lib/collaboration/object-store.ts`** — Collab state persistence with `load`/`store` + atomic writes. Must migrate to provider.
- **`CLAUDE.md`** — Project instructions; should reference the new storage abstraction.

### New Files

- **`src/lib/storage/types.ts`** — `StorageProvider` interface, `StorageMetadata` type, `StorageProviderType` enum
- **`src/lib/storage/local-provider.ts`** — `LocalFilesystemProvider` implementing `StorageProvider` using `node:fs/promises`
- **`src/lib/storage/factory.ts`** — Provider factory: reads config, instantiates and caches the active provider
- **`src/lib/storage/config.ts`** — Storage configuration (env var parsing, defaults)
- **`src/lib/storage/index.ts`** — Public barrel export
- **`src/lib/storage/__tests__/local-provider.test.ts`** — Unit tests for the local filesystem provider
- **`src/lib/storage/__tests__/factory.test.ts`** — Unit tests for the factory/registry
- **`docs/tasks/feature-generic-file-storage-b8dbb4a6/e2e-feature-generic-file-storage-b8dbb4a6.md`** — E2E test specification

## Implementation Plan

### Phase 1: Foundation
Build the storage abstraction layer from scratch:
- Define the `StorageProvider` interface with all required operations
- Define supporting types (`StorageMetadata`, config types, provider type enum)
- Implement the `LocalFilesystemProvider` that wraps current `fs` behavior
- Build the factory with env-var-driven provider selection
- Write unit tests for the local provider and factory

### Phase 2: Core Implementation
Migrate all existing server-side consumers to use the storage provider:
- Refactor `workspace/server.ts` to use the provider instead of direct `fs` calls
- Refactor `workspace/snapshots.ts` similarly
- Refactor `brain/server.ts` similarly
- Refactor `collaboration/object-store.ts` to accept a provider
- Remove duplicated helper functions (`readJsonFile`, `writeJsonFile`, `ensureDir`) that are now handled by the provider

### Phase 3: Integration
Ensure everything works together and is well documented:
- Update configuration files to support the new `NEXUS_STORAGE_PROVIDER` env var
- Verify all API routes continue working through the abstraction
- Update CLAUDE.md with storage architecture notes
- Ensure existing tests pass with zero behavior change

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Define the StorageProvider Interface and Types
- Create `src/lib/storage/types.ts` with:
  ```typescript
  export interface StorageMetadata {
    size: number;
    lastModified: string;
  }

  export interface StorageProvider {
    /** Read a file as a UTF-8 string. Returns null if not found. */
    read(key: string): Promise<string | null>;

    /** Read a file as raw bytes. Returns null if not found. */
    readBytes(key: string): Promise<Uint8Array | null>;

    /** Write a UTF-8 string to a key. Creates parent directories/prefixes as needed. */
    write(key: string, content: string): Promise<void>;

    /** Write raw bytes to a key. Creates parent directories/prefixes as needed. */
    writeBytes(key: string, content: Uint8Array): Promise<void>;

    /** Atomically write content (write to temp, then rename). Providers that don't support atomic ops fall back to regular write. */
    writeAtomic(key: string, content: string | Uint8Array): Promise<void>;

    /** Delete a single key. Returns true if deleted, false if not found. */
    delete(key: string): Promise<boolean>;

    /** Recursively delete a key prefix/directory. Returns true if anything was deleted. */
    deleteTree(key: string): Promise<boolean>;

    /** Check if a key exists. */
    exists(key: string): Promise<boolean>;

    /** Get metadata for a key. Returns null if not found. */
    stat(key: string): Promise<StorageMetadata | null>;

    /** List immediate children under a prefix. Returns relative names. */
    list(prefix: string): Promise<string[]>;

    /** List immediate child directories under a prefix. Returns relative names. */
    listDirectories(prefix: string): Promise<string[]>;
  }

  export type StorageProviderType = "local" | string;
  ```

### 2. Create the Storage Configuration
- Create `src/lib/storage/config.ts`:
  - Read `NEXUS_STORAGE_PROVIDER` env var (default: `"local"`)
  - Read `NEXUS_STORAGE_ROOT` env var as the base path/bucket (default: derived from `NEXUS_BRAIN_DATA_DIR` or `process.cwd() + "/.nexus-brain"`)
  - Use the cached singleton pattern from `workspace/config.ts`

### 3. Implement LocalFilesystemProvider
- Create `src/lib/storage/local-provider.ts`:
  - Constructor takes a `rootDir: string` parameter
  - All keys are resolved relative to `rootDir`
  - `read(key)` — `fs.readFile(path, "utf8")` with try/catch returning null
  - `readBytes(key)` — `fs.readFile(path)` returning `Uint8Array`
  - `write(key, content)` — `ensureDir` + `fs.writeFile`
  - `writeBytes(key, content)` — `ensureDir` + `fs.writeFile`
  - `writeAtomic(key, content)` — write to `path.tmp`, then `fs.rename`
  - `delete(key)` — `fs.unlink` with try/catch
  - `deleteTree(key)` — `fs.rm({ recursive: true, force: true })`
  - `exists(key)` — `fs.access` with try/catch
  - `stat(key)` — `fs.stat` returning `{ size, lastModified }`
  - `list(prefix)` — `fs.readdir` filtering for files
  - `listDirectories(prefix)` — `fs.readdir` filtering for directories
  - Include path traversal guard: all resolved paths must remain within `rootDir`

### 4. Build the Provider Factory
- Create `src/lib/storage/factory.ts`:
  - `getStorageProvider(): StorageProvider` — reads config, instantiates and caches the provider
  - For `"local"` type, creates `LocalFilesystemProvider` with the configured root
  - For unknown types, throws an error with a helpful message listing available providers
  - `resetStorageProvider(): void` — clears the cache (for testing)
  - Export a `registerStorageProvider(type: string, factory: () => StorageProvider)` for extensibility

### 5. Create Barrel Export
- Create `src/lib/storage/index.ts` exporting:
  - `StorageProvider`, `StorageMetadata`, `StorageProviderType` from `types.ts`
  - `getStorageProvider`, `resetStorageProvider`, `registerStorageProvider` from `factory.ts`
  - `LocalFilesystemProvider` from `local-provider.ts`

### 6. Write Unit Tests for Storage Layer
- Create `src/lib/storage/__tests__/local-provider.test.ts`:
  - Test `read`/`write` round-trip
  - Test `readBytes`/`writeBytes` round-trip
  - Test `writeAtomic` produces correct file
  - Test `delete` returns true for existing, false for missing
  - Test `deleteTree` removes directory recursively
  - Test `exists` returns true/false correctly
  - Test `stat` returns correct metadata
  - Test `list` returns file names under prefix
  - Test `listDirectories` returns only directories
  - Test path traversal prevention (keys with `..`)
  - Use `os.tmpdir()` + unique directory for test isolation
- Create `src/lib/storage/__tests__/factory.test.ts`:
  - Test default provider is `LocalFilesystemProvider`
  - Test caching (same instance returned)
  - Test `resetStorageProvider` clears cache
  - Test `registerStorageProvider` for custom types

### 7. Migrate workspace/server.ts to StorageProvider
- Import `getStorageProvider` from `@/lib/storage`
- Remove direct `import fs from "node:fs/promises"` and `import path from "node:path"` (keep `path` if needed for ID validation only)
- Remove local `readJsonFile`, `writeJsonFile`, `ensureDir` helpers
- Create a module-level helper `storage()` that calls `getStorageProvider()`
- Convert each function:
  - `listWorkspaces()` — use `storage().listDirectories("workspaces")` + `storage().read()` for manifests
  - `createWorkspace()` — use `storage().write()` for manifest
  - `getWorkspace()` — use `storage().read()` for manifest
  - `updateWorkspace()` — use `storage().read()` + `storage().write()`
  - `deleteWorkspace()` — use `storage().deleteTree()`
  - `createWorkflow()` — use `storage().write()` for workflow + manifest
  - `getWorkflow()` — use `storage().read()`
  - `saveWorkflow()` — use `storage().write()`
  - `updateWorkflowMeta()` — use `storage().read()` + `storage().write()`
  - `deleteWorkflow()` — use `storage().delete()` + `storage().write()`
- Key mapping: current `workspaceDir(id)` path becomes a key like `workspaces/{id}`, `manifestPath` becomes `workspaces/{id}/manifest.json`, etc.
- IMPORTANT: The workspace config `dataDir` is currently used as the root. After migration, the storage provider's root replaces this. Ensure `workspace/config.ts` still provides any non-storage config values, but the `dataDir` for file I/O is no longer used directly.

### 8. Migrate workspace/snapshots.ts to StorageProvider
- Import `getStorageProvider` from `@/lib/storage`
- Remove direct `fs` import
- Convert:
  - `writeSnapshot()` — use `storage().writeAtomic()` with key `workspaces/{wsId}/snapshots/{wfId}/{timestamp}.json`
  - `listSnapshots()` — use `storage().list()` on the snapshots prefix
  - `getSnapshot()` — use `storage().read()`

### 9. Migrate brain/server.ts to StorageProvider
- Import `getStorageProvider` from `@/lib/storage`
- Remove direct `fs` import and local `readJsonFile`/`writeJsonFile`/`ensureDir` duplicates
- Convert all file operations to use the storage provider
- Brain keys: `brain/manifest.json`, `brain/live/{wsId}/{docId}.json`, `brain/versions/{wsId}/{docId}/{versionId}.json`

### 10. Migrate collaboration/object-store.ts to StorageProvider
- Modify `CollabObjectStore` constructor to accept a `StorageProvider` instead of (or in addition to) a `dataDir` string
- Convert `load()` to use `provider.readBytes()`
- Convert `store()` to use `provider.writeAtomic()` for both state and metadata
- Keys: `collab/rooms/{roomHash}/state.bin`, `collab/rooms/{roomHash}/metadata.json`

### 11. Update Configuration Files
- Update `src/lib/workspace/config.ts`:
  - The `dataDir` can remain for backward compatibility but document that storage operations now go through the provider
  - Alternatively, simplify to only expose non-storage config
- Update `src/lib/brain/config.ts` similarly
- Ensure `NEXUS_STORAGE_PROVIDER` and `NEXUS_STORAGE_ROOT` are documented

### 12. Update Call Sites that Instantiate CollabObjectStore
- Search for all `new CollabObjectStore(...)` calls
- Update them to pass the storage provider (or a scoped sub-provider)

### 13. Create E2E Test Specification
- Create `docs/tasks/feature-generic-file-storage-b8dbb4a6/e2e-feature-generic-file-storage-b8dbb4a6.md` with:
  - **User Story**: As a user, I can create workspaces, save workflows, and perform all storage operations without noticing any change — the generic storage layer is transparent.
  - **Test Steps**:
    1. Navigate to the app at `http://localhost:3000`
    2. Create a new workspace via the workspace picker
    3. Add a workflow to the workspace
    4. Add a Start node and an Agent node to the canvas
    5. Save the workflow (Ctrl+S)
    6. Verify the workflow persists by refreshing the page
    7. Delete the workflow
    8. Verify it no longer appears in the workspace
    9. Screenshot at each key state
  - **Success Criteria**: All workspace and workflow CRUD operations work identically to before the refactor. No regressions in save, load, delete, or snapshot behavior.
  - **Screenshot capture points**: After workspace creation, after workflow save, after page refresh showing persisted data, after deletion

### 14. Run Validation Commands
- Run `bun run typecheck` — must pass with zero errors
- Run `bun run lint` — must pass with zero errors
- Run `bun run build` — must build successfully (this change affects server-side wiring)
- Run any existing tests (`bun run test` if available, or targeted test commands)

## Testing Strategy

### Unit Tests
- `local-provider.test.ts`: Full coverage of all `StorageProvider` interface methods against real temp filesystem
- `factory.test.ts`: Provider selection, caching, reset, custom registration
- Existing workspace/brain tests (if any) should continue to pass without modification

### Edge Cases
- Key with path traversal attempt (`../../etc/passwd`) — must be rejected
- Read/write of empty string content
- Read of non-existent key returns `null` (not throw)
- `writeAtomic` with concurrent writes (temp file cleanup)
- `list` on non-existent prefix returns empty array (not throw)
- `deleteTree` on non-existent path returns `false`
- Very long key names
- Keys with special characters
- Binary content via `readBytes`/`writeBytes`

## Acceptance Criteria
- A `StorageProvider` interface exists in `src/lib/storage/types.ts` with `read`, `readBytes`, `write`, `writeBytes`, `writeAtomic`, `delete`, `deleteTree`, `exists`, `stat`, `list`, and `listDirectories` methods
- A `LocalFilesystemProvider` implements the interface and preserves all current filesystem behavior
- A factory in `src/lib/storage/factory.ts` provides the active provider based on `NEXUS_STORAGE_PROVIDER` env var
- `registerStorageProvider()` allows third-party providers to be added at runtime
- `workspace/server.ts`, `workspace/snapshots.ts`, `brain/server.ts`, and `collaboration/object-store.ts` no longer import `node:fs/promises` directly for storage operations
- All existing functionality works identically (zero behavior change for end users)
- Unit tests cover the local provider and factory
- `bun run typecheck`, `bun run lint`, and `bun run build` all pass

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

- `bun run typecheck` — type check
- `bun run lint` — code quality
- `bun run build` — build check
- `bun run test:lib` — library tests (if storage tests are placed under lib)

## Notes
- The `LocalFilesystemProvider` should be a drop-in replacement for current behavior. No user-visible changes should result from this refactor alone.
- Future provider implementations (S3, Azure Blob, SharePoint) only need to implement the `StorageProvider` interface and register via `registerStorageProvider()`. No core code changes required.
- The `writeAtomic` method exists because both `workspace/snapshots.ts` and `collaboration/object-store.ts` use the temp-file-then-rename pattern for crash safety. Cloud providers can implement this as a regular write if atomic rename isn't supported.
- Browser-side storage (localStorage, File System Access API for exports) is deliberately out of scope — this feature targets server-side persistence only.
- The `collaboration/object-store.ts` migration is the most nuanced because it deals with binary data (`Uint8Array`). The `readBytes`/`writeBytes` methods on the interface handle this.

# Persistent Brain Storage And Server-Backed Collaboration

**ADW ID:** N/A
**Date:** 2026-04-10
**Plan:** N/A

## Overview

This feature moves Brain documents from browser-only storage into a server-backed workspace with signed share tokens, filesystem persistence, and version history. It also replaces peer-to-peer collaboration with a Hocuspocus server that persists room state, so shared workflow sessions survive reconnects and restarts.

Current status: workspace mode now has an optional SpacetimeDB backend. When `NEXT_PUBLIC_SPACETIME_URI` is configured, Brain document operations are routed through the SpacetimeDB sync bridge and generated reducers instead of these filesystem Brain API routes. This document remains the reference for the legacy filesystem Brain backend and Hocuspocus-backed collaboration path.

## What Was Built

- A file-backed Brain store with workspace sessions, signed tokens, live document files, manifest tracking, and version snapshots.
- Brain API routes for session bootstrap, document CRUD, feedback, view tracking, version listing, version restore, and share-token generation.
- A client-side Brain session bootstrap that migrates legacy local docs once, stores the workspace token, and syncs documents from the API.
- Knowledge store and Brain panel updates for async loading/saving, server deletes, feedback submission, and version restore UI.
- Collaboration transport moved from `y-webrtc` to Hocuspocus with a persisted room-state object store.
- Local and Docker startup paths for the Brain storage directory and the collaboration server.

## Technical Implementation

### Files Modified

- `src/lib/brain/server.ts`: Implements the file-backed Brain manifest, token signing, workspace session creation, document persistence, version snapshots, feedback storage, and restore logic.
- `src/lib/brain/client.ts`: Bootstraps Brain sessions in the browser, migrates existing local docs, and wraps the Brain API endpoints.
- `src/app/api/brain/session/route.ts`: Creates or resumes a Brain workspace session.
- `src/app/api/brain/documents/route.ts`: Lists and saves Brain documents for the active workspace.
- `src/app/api/brain/documents/[id]/route.ts`: Deletes a Brain document.
- `src/app/api/brain/documents/[id]/view/route.ts`: Records document views.
- `src/app/api/brain/documents/[id]/feedback/route.ts`: Adds feedback entries to a document.
- `src/app/api/brain/documents/[id]/versions/route.ts`: Returns version history metadata for a document.
- `src/app/api/brain/documents/[id]/restore/route.ts`: Restores a saved version into the live document.
- `src/store/knowledge/store.ts`: Converts Brain actions to async API-backed operations and keeps local cache in sync.
- `src/components/workflow/brain-panel/doc-editor.tsx`: Adds async save/feedback flows and a version history restore panel.
- `src/components/workflow/brain-panel/panel.tsx`: Adds loading/saving UX for the shared Brain backend.
- `src/lib/collaboration/collab-doc.ts`: Replaces WebRTC with Hocuspocus and seeds workflow/Brain state on first sync.
- `src/lib/collaboration/object-store.ts`: Persists Hocuspocus room state and metadata on disk.
- `scripts/collab-server.ts`: Starts the Hocuspocus server and stores room state through the object store.
- `scripts/start.sh`: Sets up local env defaults and starts both the app and the collab server.
- `.env.example`, `docker-compose.yml`, `Dockerfile`, `package.json`: Add Brain/collab environment variables, runtime wiring, and Hocuspocus dependencies.

### Key Changes

- Brain documents now live in a server workspace identified by a signed token stored in `localStorage` and shareable through `/api/brain/shares`.
- Every save writes the live doc plus a version snapshot, and restore creates a new `restore` version instead of mutating history silently.
- Legacy local Brain data is migrated once during session bootstrap so existing user content is preserved.
- Collaboration rooms now reconnect through a Hocuspocus server and reload persisted Y.js state from disk.
- Share links and copy actions now describe persisted rooms instead of peer-to-peer sessions.

## How to Use

1. Start the stack with `bun run start:local` for local development or `bun run start:docker` for Docker.
2. Open the Brain panel in the app; the client creates or resumes a Brain workspace session automatically.
3. Create, edit, import, or delete Brain documents as before, but changes now sync through the Brain API.
4. Open a document to increment views, leave feedback, or restore an earlier saved version from the Version History section.
5. Start workflow collaboration from the share controls; collaborators join the same persisted room through the Hocuspocus server.

## Configuration

- `NEXUS_BRAIN_DATA_DIR`: Filesystem directory for Brain manifests, live docs, and saved versions. Defaults to `./.nexus-brain`.
- `NEXUS_BRAIN_TOKEN_SECRET`: Secret used to sign Brain workspace/share tokens.
- `NEXUS_COLLAB_DATA_DIR`: Filesystem directory for persisted collaboration room state. Defaults to `./.nexus-collab`.
- `NEXUS_COLLAB_SERVER_PORT`: Port used by the Hocuspocus collaboration server. Default `1234`.
- `NEXT_PUBLIC_COLLAB_SERVER_URL`: Browser WebSocket URL for the collaboration server.

## Testing

Targeted tests passed with:

`bun test src/lib/__tests__/brain-server.test.ts src/lib/__tests__/collaboration-object-store.test.ts`

The test coverage verifies legacy Brain migration, imported metadata preservation, share-token resume behavior, and persisted collaboration room storage.

## Notes

- For SpacetimeDB-backed workspace mode, see `docs/tasks/feature-spacetimedb-backend-sync-feature/doc-feature-spacetimedb-backend-sync-feature.md`.
- Brain sessions are workspace-scoped but still anonymous; possession of a valid token or share link grants access.
- Deleted documents are soft-deleted in the manifest and recorded as version events.
- No screenshots were provided for this documentation task.

# Conditional Documentation Guide

## Instructions
- Review the task you've been asked to perform
- Check each documentation path in the Conditional Documentation section
- For each path, evaluate if any of the listed conditions apply to your task
- IMPORTANT: Only read the documentation if any one of the conditions match your task
- IMPORTANT: You don't want to excessively read documentation. Only read the documentation if it's relevant to your task.

## Conditional Documentation
- docs/tasks/persistent-brain/doc-persistent-brain.md
  - Conditions:
    - When working with Brain document persistence, migration, import/export, or version restore
    - When modifying `src/app/api/brain/*` routes or the `src/lib/brain/*` storage/session layer
    - When troubleshooting persisted collaboration rooms, Hocuspocus startup, or share-link behavior

- docs/tasks/feature-spacetimedb-backend-sync-feature/doc-feature-spacetimedb-backend-sync-feature.md
  - Conditions:
    - When working with SpacetimeDB integration, workspace persistence, or real-time sync
    - When modifying files in `src/lib/spacetime/`, `spacetime/nexus/`, or workspace sync bridges
    - When configuring `NEXT_PUBLIC_SPACETIME_URI` or SpacetimeDB Docker services
    - When troubleshooting workspace mode persistence, multi-user collaboration, or presence
    - When migrating data from filesystem-based workspaces to SpacetimeDB

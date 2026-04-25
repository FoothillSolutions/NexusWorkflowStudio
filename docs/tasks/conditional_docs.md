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
- docs/tasks/feature-workspace-foundation-616005e8/doc-feature-workspace-foundation-616005e8.md
  - Conditions:
    - When working with workspaces, the workspace dashboard, or workspace-scoped workflow editing
    - When modifying `src/app/api/workspaces/*`, `src/lib/workspace/*`, `src/components/workspace/*`, or `src/app/workspace/[id]/**`
    - When changing routing between `/`, `/editor`, and `/workspace/[id]/workflow/[wid]`
    - When touching workspace auto-save, recent-workspace `localStorage` history, or stable Y.js room IDs for workspace workflows
- docs/tasks/documents-skill-library/doc-documents-skill-library.md
  - Conditions:
    - When working with the Documents Skill Library (packs, skills, documents, publish, fork/merge, validation, .nexus export/import)
    - When modifying `src/app/api/library/*` routes or the `src/lib/library-store/*` layer
    - When changing the workflow Skill node's `libraryRef` data or the SkillPickerDialog
    - When updating the Documents panel UI or the per-document Y.js collab binding
- docs/tasks/feature-documents-skill-library-60d267bf/doc-feature-documents-skill-library-60d267bf.md
  - Conditions:
    - When working with the Documents Skill Library MVP (packs, skills, documents, publish, fork/merge, validation, `.nexus` export/import)
    - When modifying `src/app/api/library/*` routes or the `src/lib/library-store/*` layer
    - When changing the workflow Skill node's `libraryRef` data or the `SkillPickerDialog`
    - When updating the Documents panel UI or the per-document Y.js collab binding for library docs

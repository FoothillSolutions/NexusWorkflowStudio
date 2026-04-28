---
name: nexus-playwright
description: Use when testing Nexus Workflow Studio in a browser with playwright-cli; includes route map, auth/session handling, screenshots, and core feature workflows.
allowed-tools: Bash(playwright-cli:*), Bash(mkdir:*)
---

# Nexus Playwright Testing

Use this project-specific skill with `playwright-cli` when manually testing Nexus Workflow Studio in a browser.

## Mandatory rules

- Create `.playwright-screenshots/` before taking screenshots.
- Save screenshots with descriptive filenames under `.playwright-screenshots/`.
- Start from the configured frontend URL, usually `http://localhost:3000`.
- Prefer `playwright-cli snapshot` before clicking, typing, or asserting so refs match the current DOM.
- Use accessible text, labels, button names, and headings from the UI instead of brittle coordinates.
- Run `playwright-cli snapshot` again after navigation, opening dialogs, canvas changes, or any action that re-renders the page.
- Never print secrets, auth tokens, cookies, or provider credentials. Reuse authenticated sessions with persistent profiles or `state-save`/`state-load`.
- Keep OpenCode checks optional unless an OpenCode server is intentionally running.

## Quick start

```bash
mkdir -p .playwright-screenshots
playwright-cli open http://localhost:3000
playwright-cli snapshot
playwright-cli screenshot --filename=.playwright-screenshots/landing.png
```

## Nexus route landmarks

- `/` — landing page with `Nexus Workflow Studio`, `Open Editor`, `Open Workspace`, `New workspace`, and recent workspaces.
- `/editor` — standalone workflow editor with header actions, canvas, node palette, toolbar, and properties panel when a node is selected.
- `/workspace/[id]` — workspace dashboard with workspace header and workflow creation cards/buttons.
- `/workspace/[id]/workflow/[wid]` — workspace-scoped workflow editor when a workflow exists and loads successfully.
- `/api/auth/signin` — NextAuth sign-in page when authentication is enabled.

## Common command flow

```bash
playwright-cli open http://localhost:3000
playwright-cli snapshot
# click by the current ref from snapshot, then resnapshot before the next action
playwright-cli screenshot --filename=.playwright-screenshots/editor-loaded.png
playwright-cli state-save .playwright-auth/nexus-auth.json
playwright-cli close
```

For detailed route maps, authentication/session handling, core workflow checks, screenshot points, and troubleshooting, read [`docs/testing/playwright-agent-guide.md`](../../../docs/testing/playwright-agent-guide.md).

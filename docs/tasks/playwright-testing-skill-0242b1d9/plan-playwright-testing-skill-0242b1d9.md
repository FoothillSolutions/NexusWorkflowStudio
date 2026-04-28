# feature: Playwright Testing Skill

## Metadata
adw_id: `0242b1d9`
document_description: `testing  playwright`

## Description
The Task document requests a Playwright-focused agent skill or guide that helps future testing agents navigate and exercise the Nexus Workflow Studio website with less guesswork. The guide should tell agents how to reach important pages, how authentication works, how to preserve an authenticated browser session, and how to use core application features during browser-based testing.

Complexity assessment: `medium`. The feature is primarily developer/agent tooling documentation, but it needs accurate coverage of routes, optional authentication, workspace flows, editor flows, and Playwright CLI conventions.

## Objective
Create a project-specific Playwright testing skill and supporting documentation that future agents can use to reliably test Nexus Workflow Studio. When complete, an agent should be able to start from the app URL, navigate to landing/workspace/editor routes, handle optional auth, perform representative workflow-editor actions, capture screenshots, and inspect browser state using `playwright-cli` conventions.

## Problem Statement
Browser-testing agents currently have only generic Playwright CLI instructions and must infer Nexus-specific routes, auth behavior, page flows, and feature usage from the codebase each time. This increases test time and makes manual E2E validation inconsistent.

## Solution Statement
Add a Nexus-specific Playwright testing skill under `.claude/skills/` and a durable guide under `docs/testing/`. The skill should be short and action-oriented; the docs should contain the deeper route map, authentication guidance, feature workflows, screenshot/state conventions, and troubleshooting notes. Link the guide from contributor documentation so humans and agents can discover it.

## Code Patterns to Follow
Reference implementations:
- `.claude/skills/nexus-develop/SKILL.md` — local skill frontmatter and markdown structure.
- `/home/falfaddaghi/.agents/skills/adw--playwright-cli/SKILL.md` — generic `playwright-cli` command style, screenshot directory rule, session/state commands, and examples.
- `docs/tasks/feature-workspace-foundation-616005e8/e2e-feature-workspace-foundation-616005e8.md` — existing E2E plan style for route-oriented manual browser steps.
- `README.md` — current user-facing route and workflow behavior.
- `CONTRIBUTING.md` — existing testing/developer documentation conventions.

## Relevant Files
Use these files to complete the task:

- `CLAUDE.md` — project coding rules, Bun preference, frontend-first architecture, and validation expectations.
- `.app_config.yaml` — validation commands and web UI metadata; use its configured commands in the final validation step.
- `README.md` — source of truth for user-facing product behavior, app startup, editor usage, generation/export, and shortcuts.
- `CONTRIBUTING.md` — add or update a short discoverability link to the new Playwright guide if appropriate.
- `.claude/skills/nexus-develop/SKILL.md` — local skill format to follow for a new project-specific testing skill.
- `/home/falfaddaghi/.agents/skills/adw--playwright-cli/SKILL.md` — command reference to mirror for Playwright CLI usage.
- `docs/tasks/conditional_docs.md` — reviewed for additional docs; no mandatory extra documentation applies unless implementation changes workspace routing or workspace code.
- `src/app/page.tsx` — confirms `/` renders the landing page.
- `src/app/editor/page.tsx` — confirms `/editor` renders the standalone workflow editor.
- `src/app/workspace/[id]/page.tsx` — confirms `/workspace/[id]` renders the workspace dashboard.
- `src/components/workspace/landing-page.tsx` — source for landing page CTAs: `Open Editor`, `Open Workspace`, and `New workspace`.
- `src/components/workspace/dashboard.tsx` — source for workspace dashboard controls and workflow creation navigation.
- `src/proxy.ts` — source for optional authentication behavior and redirect/API 401 behavior.
- `src/lib/auth/env.ts` and `src/lib/auth/config.ts` — source for auth-enabling environment variables and OIDC/NextAuth behavior.

### New Files
- `.claude/skills/nexus-playwright/SKILL.md` — new project-specific skill telling agents how to test Nexus with `playwright-cli`.
- `docs/testing/playwright-agent-guide.md` — durable detailed guide with route map, auth flow, feature workflows, state handling, screenshots, and troubleshooting.

## Implementation Plan
### Phase 1: Foundation
- Confirm current route map and auth behavior from app code.
- Define the boundaries: this feature is documentation/agent tooling only; do not change runtime app behavior.
- Decide the guide structure so the skill can be concise and link to the full guide.

### Phase 2: Core Implementation
- Create `.claude/skills/nexus-playwright/SKILL.md` with YAML frontmatter, trigger description, allowed tool guidance for `playwright-cli`, and Nexus-specific quick-start steps.
- Create `docs/testing/playwright-agent-guide.md` with detailed reusable testing instructions.
- Include concrete `playwright-cli` command examples and exact routes/control names where available.

### Phase 3: Integration
- Add a short link from `CONTRIBUTING.md` to the Playwright guide under testing conventions or development setup.
- Ensure the guide stays aligned with existing docs and does not duplicate long dependency/version data.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Verify Current Nexus Browser Flows
- Re-read the relevant route and component files listed above.
- Document the route map:
  - `/` — landing page with `Open Editor`, `Open Workspace`, `New workspace`, and recent workspaces.
  - `/editor` — standalone workflow editor.
  - `/workspace/[id]` — workspace dashboard.
  - `/workspace/[id]/workflow/[wid]` — workspace-scoped editor route if present in the current tree; if the route file is absent, note that the dashboard currently attempts to navigate there and the guide should avoid promising unsupported behavior.
  - `/api/auth/signin` — NextAuth sign-in page when auth is enabled.
- Document optional auth behavior from `src/proxy.ts`: auth disabled when required `AUTH_*` vars are incomplete/missing; page routes redirect to sign-in when enabled and unauthenticated; API routes return `401` JSON.

### 2. Create the Nexus Playwright Skill
- Create `.claude/skills/nexus-playwright/SKILL.md`.
- Use frontmatter similar to:
  ```yaml
  ---
  name: nexus-playwright
  description: Use when testing Nexus Workflow Studio in a browser with playwright-cli; includes route map, auth/session handling, screenshots, and core feature workflows.
  allowed-tools: Bash(playwright-cli:*), Bash(mkdir:*)
  ---
  ```
- Include mandatory rules:
  - Create `.playwright-screenshots/` before screenshots.
  - Save screenshots with descriptive filenames in `.playwright-screenshots/`.
  - Start from the configured frontend URL, usually `http://localhost:3000`.
  - Prefer `snapshot` to discover current refs before clicking/typing.
  - Use accessible text/labels from the UI instead of brittle coordinates.
  - Never print secrets or auth tokens; use persistent profiles or `state-save` for auth reuse.
- Include a concise quick-start command sequence:
  ```bash
  mkdir -p .playwright-screenshots
  playwright-cli open http://localhost:3000
  playwright-cli snapshot
  playwright-cli screenshot --filename=.playwright-screenshots/landing.png
  ```
- Link to `docs/testing/playwright-agent-guide.md` for the detailed route and feature guide.

### 3. Create the Detailed Playwright Agent Guide
- Create `docs/testing/playwright-agent-guide.md`.
- Include these sections:
  - Purpose and scope.
  - Prerequisites: dev server running, frontend URL, no backend assumption, optional OpenCode server only for AI/OpenCode features.
  - Browser/session lifecycle: `open`, `snapshot`, `goto`, `state-save`, `state-load`, `close`, and screenshot directory conventions.
  - Route map and expected page landmarks.
  - Authentication guide:
    - Default local development normally has auth disabled.
    - Auth is enabled only when all `AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, and `AUTH_SECRET` are set.
    - For enabled auth, navigate to `/`, follow redirect/sign-in, complete provider login manually or with available test credentials, then run `playwright-cli state-save .playwright-auth/nexus-auth.json` if a reusable state is needed.
    - For API auth checks, expect unauthenticated protected API calls to return `{ "error": "Unauthorized" }` with status `401`.
  - Core feature workflows:
    - Landing page to standalone editor.
    - Landing page to new workspace/dashboard.
    - Creating a workflow from a workspace dashboard, with a caveat if the workspace workflow route is not currently implemented in the checked-out tree.
    - Basic editor smoke test: verify canvas/palette/properties shell, add or inspect nodes using currently visible controls, open generate/export preview if visible.
    - Local persistence checks: reload and inspect localStorage where relevant.
    - Optional OpenCode checks: connect only when an OpenCode server is intentionally running; otherwise verify offline/editor-only flows still work.
  - Recommended screenshot capture points: landing, editor loaded, workspace dashboard, create workflow state, generate/export dialog if tested, auth sign-in if auth is enabled.
  - Troubleshooting: stale refs after DOM updates, hidden dialogs, auth redirects, canvas interactions, localStorage cleanup, API 401s, and console/network inspection.
- Keep examples command-oriented and avoid claiming exact element refs, because refs change per Playwright snapshot.

### 4. Link the Guide from Contributor Documentation
- Update `CONTRIBUTING.md` under testing conventions or development setup with a short subsection such as `Browser testing with playwright-cli`.
- Link to `docs/testing/playwright-agent-guide.md`.
- Mention that the repository also includes `.claude/skills/nexus-playwright/SKILL.md` for agent-driven browser testing.

### 5. Review for Accuracy and Maintainability
- Ensure the skill and guide do not duplicate package versions or stale route details from older docs.
- Ensure any route or feature claims are backed by current files or clearly marked as conditional/optional.
- Ensure auth guidance matches `src/proxy.ts`, `src/lib/auth/env.ts`, and `src/lib/auth/config.ts`.
- Ensure the guide instructs agents to use `playwright-cli snapshot` before actions and screenshot key states.

### 6. Run Validation Commands
- Run every command listed in the `Validation Commands` section.
- Fix any docs formatting, lint, type, or build issues introduced by the documentation changes.

## Testing Strategy
### Unit Tests
- No unit tests are required because the implementation is documentation and agent-skill content only.
- If implementation unexpectedly changes runtime TypeScript/React files, add or update focused tests for that changed behavior before validation.

### Edge Cases
- Auth disabled: `/` and `/editor` should load without sign-in.
- Auth enabled: protected pages redirect to `/api/auth/signin`; unauthenticated API routes return `401` JSON.
- Missing workspace workflow route: guide must avoid instructing agents to rely on routes that are not implemented in the current tree.
- OpenCode disconnected: guide should keep editor-only flows separate from optional OpenCode-dependent testing.
- Playwright refs stale after UI changes: guide should instruct agents to call `snapshot` after navigation, dialogs, and canvas changes.
- Secrets: guide must not ask agents to print or store secrets in screenshots/logs.

## Acceptance Criteria
- `.claude/skills/nexus-playwright/SKILL.md` exists with valid YAML frontmatter and actionable Nexus-specific Playwright CLI instructions.
- `docs/testing/playwright-agent-guide.md` exists and covers route navigation, optional auth/session handling, screenshots, core feature workflows, and troubleshooting.
- `CONTRIBUTING.md` links to the new guide.
- The guide accurately reflects the current route/auth behavior from the relevant source files.
- No runtime app behavior is changed.
- Validation commands complete without errors.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

Use validation commands from `.app_config.yaml`:

```bash
npm run typecheck
npm run lint
npm run build
```

`.app_config.yaml` has no `commands.test` value configured. Do not run browser commands here; Playwright/`playwright-cli` execution belongs to separate manual or E2E validation.

## Notes
- The project README and CONTRIBUTING prefer Bun commands, but `.app_config.yaml` currently specifies `npm run ...` for validation. Follow `.app_config.yaml` for this plan's validation commands unless the implementer updates app config separately.
- This plan intentionally avoids adding E2E execution steps because the requested feature is a testing skill/guide, not a user-facing UI behavior change.

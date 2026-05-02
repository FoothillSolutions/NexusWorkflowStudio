# feature: Claude Plugin Export for Cowork

## Metadata
adw_id: `ba5f56d5`
document_description: `Claude Plugin Export for Cowork`

## Description
The task updates Nexus Workflow Studio's existing `Claude Code` generation target so it exports a valid Claude/Cowork plugin package instead of legacy files under `.claude/`. The resulting package must be usable as a Cowork custom plugin upload ZIP, as a local Claude Code plugin via `claude --plugin-dir <plugin-dir>`, and as a standalone plugin folder that can later be copied into a Cowork marketplace repository.

The Claude target should keep the same Nexus workflow semantics, generated agent files, connected skills, scripts, documents, and round-trip workflow JSON, but package them at the plugin root with `.claude-plugin/plugin.json`, `skills/run/SKILL.md`, `agents/*.md`, `skills/<skill-name>/SKILL.md`, `skills/<skill-name>/scripts/*`, `docs/**`, `nexus/<workflow>.json`, and `README.md`. Generated content must reference bundled files with `${CLAUDE_PLUGIN_ROOT}/...`, never `.claude/...` or paths outside the plugin. OpenCode and PI exports must remain byte-compatible except for intentional shared helper refactors.

Complexity assessment: `complex` because the change crosses target path helpers, workflow generation, node generators, export ZIP/folder behavior, UI copy, documentation, and regression tests.

## Objective
Implement a Claude/Cowork plugin packaging layer for the existing `claude-code` target while preserving OpenCode and PI export behavior. After implementation, Claude exports produce plugin-root-relative packages with valid plugin metadata, a namespaced `run` skill, bundled resources, no legacy `.claude` output, no generated Claude run scripts, and validation coverage including `claude plugin validate`.

## Problem Statement
Nexus currently treats the Claude target like OpenCode and PI by generating legacy command artifacts beneath `.claude/`, including `.claude/commands/<workflow>.md`, `.claude/agents`, `.claude/skills`, `.claude/docs`, and root-level run scripts. Claude/Cowork plugins use a different package structure: `.claude-plugin/plugin.json` is required at the plugin root, skills/agents/commands live at the plugin root, and workflows should be exposed as plugin skills with namespaced invocation such as `/nexus-review-pr:run`. The current output is not suitable for direct Cowork upload and risks writing into or merging with a repository `.claude/` folder.

## Solution Statement
Keep the public target id `claude-code` for compatibility, but change its generation semantics to `Claude/Cowork Plugin`. Add pure Claude plugin helpers for plugin name sanitization, plugin manifest generation, plugin README generation, workflow JSON embedding, and plugin-root-relative file paths. Refactor artifact path builders so file paths and in-file resource references are distinct: Claude file paths are plugin-root relative while Claude resource references use `${CLAUDE_PLUGIN_ROOT}/...`; OpenCode/PI continue using `.opencode` and `.pi`. Route direct folder exports for Claude into a `nexus-<workflow-slug>` plugin folder unless the selected directory is already that plugin root; ZIP exports place `.claude-plugin/plugin.json` at ZIP root.

## Code Patterns to Follow
Reference implementations:
- `src/lib/generation-targets.ts` centralizes generation target metadata and path builders; extend this rather than duplicating target-specific string construction.
- `src/lib/workflow-generator.ts` orchestrates generated files and delegates node-specific artifacts to `src/nodes/*/generator.ts`; keep node generators modular.
- `src/lib/generated-workflow-export.ts` owns browser directory/ZIP export and already has helpers for root partitioning and ZIP creation; add Claude plugin branching here rather than from UI components.
- `src/lib/persistence.ts` provides workflow JSON serialization and export filenames; reuse its JSON content helpers for `nexus/<workflow>.json`.
- `src/nodes/agent/generator.ts`, `src/nodes/sub-workflow/generator.ts`, and `src/nodes/shared/claude-code-frontmatter.ts` already contain Claude-specific frontmatter restrictions; preserve those rules for generated plugin agents.
- `src/lib/workflow-generation/detail-sections.ts` is where in-file references to generated skills/docs are emitted; update reference helpers there instead of hard-coded path strings.
- `src/components/workflow/generated-export-dialog.tsx` follows the existing dark-theme dialog/card pattern for target selection and folder export messaging.
- Existing Bun tests use `bun:test` with small workflow fixtures in `src/test-support/workflow-fixtures.ts`; follow those patterns for generation regressions.

Pattern replacement/removal research performed:
- `.claude` occurrences:
  - `CLAUDE.md`: 1
  - `README.md`: 2
  - `src/lib/generation-targets.ts`: 1
  - `src/nodes/shared/claude-code-frontmatter.ts`: 2
  - `src/nodes/skill/fields.tsx`: 1
  - `src/nodes/sub-workflow/generator.ts`: 1
  - `src/nodes/parallel-agent/__tests__/generator.test.ts`: 5
  - `src/lib/__tests__/generation-targets.test.ts`: 3
  - `src/lib/marketplace/parser.ts`: 2
  - `src/lib/marketplace/index.ts`: 2
  - `src/nodes/agent/generator.ts`: 1
- `claude-code` occurrences:
  - `src/lib/generation-targets.ts`: 3
  - `src/lib/__tests__/run-script-generator.test.ts`: 2
  - `src/lib/__tests__/generation-targets.test.ts`: 3
  - `src/lib/run-script-generator.ts`: 1
  - `src/components/workflow/generated-export-dialog.tsx`: 1
  - `src/nodes/agent/generator.ts`: 2
  - `src/nodes/sub-workflow/generator.ts`: 2
  - `src/nodes/handoff/__tests__/generator.test.ts`: 2
  - `src/nodes/parallel-agent/__tests__/generator.test.ts`: 2
- `Claude Code` copy occurrences:
  - `CLAUDE.md`: 2
  - `README.md`: 3
  - `src/lib/generation-targets.ts`: 2
  - `src/lib/changelog.ts`: 3
  - `src/nodes/shared/claude-code-frontmatter.ts`: 7
  - `src/nodes/agent/generator.ts`: 4
  - `src/nodes/sub-workflow/generator.ts`: 1
- `commands/` occurrences:
  - `README.md`: 2
  - `src/lib/generation-targets.ts`: 1
  - `src/lib/__tests__/generation-targets.test.ts`: 2
  - `src/lib/marketplace/parser.ts`: 1
  - `src/nodes/handoff/__tests__/generator.test.ts`: 1
  - `src/store/__tests__/prompt-gen/helpers.test.ts`: 1
  - `src/store/prompt-gen/helpers.ts`: 4
- `run-` occurrences relevant to generated exports:
  - `README.md`: 10
  - `src/lib/workflow-generator.ts`: 1
  - `src/lib/__tests__/run-script-generator.test.ts`: 6
  - `src/lib/run-script-generator.ts`: 3
  - `bun.lock`: 13 (dependency lockfile noise; do not edit)
- `rootDir` occurrences in `src`:
  - `src/lib/generated-workflow-export.ts`: 3
  - `src/lib/generation-targets.ts`: 9
  - `src/lib/__tests__/generation-targets.test.ts`: 3
  - `src/lib/workflow-generation/detail-sections.ts`: 8
  - `src/components/workflow/header/generate-menu.tsx`: 1
  - `src/components/workflow/generated-export-dialog.tsx`: 11
  - `src/nodes/skill/generator.ts`: 2

## Relevant Files
Use these files to complete the task:

- `CLAUDE.md` — project coding rules, use Bun preference, source-of-truth pointers, and validation expectations.
- `.app_config.yaml` — app configuration and required validation command names (`npm run typecheck`, `npm run lint`, `npm run build`).
- `README.md` — user-facing export documentation currently describing `.claude` and run scripts; update Claude target docs to plugin packaging while preserving OpenCode/PI docs.
- `/media/falfaddaghi/extradrive2/repo/NexusWorkflowStudio/docs/spec/spec-export-claude-plugin.md` — source spec mirrored by the task document; every product requirement and test-plan item should be covered.
- `src/lib/generation-targets.ts` — generation target metadata and path builder refactor point; add Claude plugin name/path/reference helpers here or re-export from a focused helper.
- `src/lib/workflow-generator.ts` — main artifact orchestration; route Claude command markdown into plugin skills, append plugin package files, include `nexus/<workflow>.json`, and skip run scripts for Claude.
- `src/lib/generated-workflow-export.ts` — ZIP and direct folder export behavior; special-case Claude plugin root folder resolution and ZIP root layout.
- `src/lib/run-script-generator.ts` — ensure Claude plugin exports do not include generated run scripts while OpenCode/PI continue to do so.
- `src/lib/workflow-generation/detail-sections.ts` — generated workflow instructions reference connected skills/docs; switch Claude references to `${CLAUDE_PLUGIN_ROOT}/...`.
- `src/nodes/agent/generator.ts` — agent variable mappings currently use file path builders; ensure Claude references use plugin-root env paths while agent file paths remain `agents/*.md`.
- `src/nodes/skill/generator.ts` — connected script instructions currently reference target root dirs; switch Claude instructions to `${CLAUDE_PLUGIN_ROOT}/skills/...`.
- `src/nodes/document/generator.ts` — document artifact paths should become `docs/**` for Claude plugin while OpenCode/PI remain unchanged.
- `src/nodes/sub-workflow/generator.ts` — sub-workflow agent/command behavior needs Claude plugin-safe invocation/reference handling.
- `src/nodes/shared/claude-code-frontmatter.ts` — keep existing Claude-compatible agent frontmatter mapping; do not add unsupported plugin fields here.
- `src/components/workflow/generated-export-dialog.tsx` — update UI copy for Claude target folder/ZIP behavior and dynamic plugin folder naming.
- `src/components/workflow/header/generate-menu.tsx` — update target subtitle/root display so Claude no longer implies `.claude`.
- `src/components/workflow/header/use-header-controller.ts` — preview currently shows default command markdown; adjust only if preview should target plugin `run` skill output.
- `src/lib/__tests__/generation-targets.test.ts` — update path/reference expectations for Claude while keeping OpenCode/PI path assertions.
- `src/lib/__tests__/run-script-generator.test.ts` — update/remove Claude run-script expectations; add OpenCode/PI no-regression coverage.
- `src/nodes/parallel-agent/__tests__/generator.test.ts` — update Claude dynamic parallel-agent resource references to `${CLAUDE_PLUGIN_ROOT}/...`.
- `src/nodes/handoff/__tests__/generator.test.ts` — preserve handoff generation and update any Claude target expectations if impacted.
- `src/lib/changelog.ts` — optionally add an entry describing the Claude/Cowork plugin export improvement if the project convention requires user-visible change notes.

### New Files
- `src/lib/claude-plugin-export.ts` — focused helper module for plugin name sanitization/truncation, plugin manifest, plugin README, plugin-root detection, Claude resource-reference paths, and command-markdown-to-skill conversion if these concerns would clutter `generation-targets.ts`.
- `src/lib/__tests__/claude-plugin-export.test.ts` — regression tests for plugin manifest, package layout, no `.claude` paths, bundled agents/skills/scripts/docs/workflow JSON, no run scripts, and `claude plugin validate` integration.
- `src/lib/__tests__/generated-workflow-export.test.ts` — optional focused tests for pure export-planning helpers if directory/ZIP behavior is factored into testable pure functions.
- `docs/tasks/claude-plugin-export-for-cowork-ba5f56d5/e2e-claude-plugin-export-for-cowork-ba5f56d5.md` — E2E specification to be created during implementation (do not run it in validation commands).

## Implementation Plan
### Phase 1: Foundation
Add target/package abstractions that distinguish generated artifact paths from resource reference paths. Define Claude plugin name rules (`nexus-<workflow-slug>`, lowercase hyphen, max 64 chars), plugin-root-relative artifact paths, and `${CLAUDE_PLUGIN_ROOT}/...` reference paths. Add tests for helpers before broad generation rewrites.

### Phase 2: Core Implementation
Refactor workflow generation so `claude-code` produces a Claude/Cowork plugin package: `.claude-plugin/plugin.json`, `skills/run/SKILL.md` with `disable-model-invocation: true`, root `agents`, root connected `skills`, root `docs`, `nexus/<workflow>.json`, and plugin `README.md`. Convert or suppress any legacy command artifacts so no `.claude/` path or legacy `.claude/commands` output remains. Skip run scripts for Claude only.

### Phase 3: Integration
Update browser export behavior for ZIP and direct folder export, update UI text to describe plugin packages and dynamic plugin folder names, update README/changelog copy, and expand tests including a representative plugin validation with `claude plugin validate`.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Add Claude Plugin Helper Tests First
- Create `src/lib/__tests__/claude-plugin-export.test.ts` with failing tests for:
  - `buildClaudePluginName("Review PR") === "nexus-review-pr"`.
  - Names are lowercase hyphen slugs, contain only Claude-compatible characters, and truncate to 64 characters.
  - Plugin manifest contains only supported top-level fields required by the task: `name`, `description`, `author`, `keywords`.
  - Claude resource references use `${CLAUDE_PLUGIN_ROOT}/skills/...` and `${CLAUDE_PLUGIN_ROOT}/docs/...`.
- Include an integration-style fixture workflow with start, agent, connected skill, connected script, connected document, and end nodes.
- Assert generated Claude files include `.claude-plugin/plugin.json`, `skills/run/SKILL.md`, `agents/<agent>.md`, `skills/<skill>/SKILL.md`, `skills/<skill>/scripts/<script>`, `docs/<doc>`, `nexus/<workflow>.json`, and `README.md`.
- Assert generated Claude file paths and contents do not contain `.claude/`.
- Assert generated Claude files do not include `run-<workflow>.sh` or `run-<workflow>.bat`.

### 2. Implement Claude Plugin Helper Module
- Add `src/lib/claude-plugin-export.ts` or equivalent helpers.
- Implement `buildClaudePluginName(workflowName: string): string`:
  - Sanitize with lowercase hyphen behavior.
  - Prefix with `nexus-`.
  - Collapse repeated hyphens and trim leading/trailing hyphens.
  - Truncate to 64 characters without leaving a trailing hyphen.
  - Fall back to `nexus-workflow` if the workflow name has no usable characters.
- Implement plugin manifest builder returning formatted JSON with no unsupported custom fields.
- Implement plugin README builder with install notes for Cowork ZIP upload, local `claude --plugin-dir <plugin-dir>`, marketplace copy, and invocation `/plugin-name:run`.
- Implement skill frontmatter conversion for the main workflow skill:
  ```md
  ---
  name: run
  description: <workflow name or description>
  disable-model-invocation: true
  ---
  <workflow execution guide body>
  ```
- Add reference path helpers such as `buildGeneratedSkillReferencePath`, `buildGeneratedDocsReferencePath`, and `buildGeneratedSkillScriptReferencePath` so Claude references use `${CLAUDE_PLUGIN_ROOT}/...` while OpenCode/PI references continue to use `.opencode` and `.pi`.

### 3. Refactor Target Metadata and Path Builders
- Update `src/lib/generation-targets.ts` to describe the Claude target as a Claude/Cowork plugin package while preserving `GenerationTargetId = "claude-code"`.
- Do not use `.claude` as Claude's artifact root.
- Ensure artifact path builders return:
  - OpenCode: `.opencode/commands`, `.opencode/agents`, `.opencode/skills`, `.opencode/docs`.
  - PI: `.pi/commands`, `.pi/agents`, `.pi/skills`, `.pi/docs`.
  - Claude plugin: `skills/run/SKILL.md` for the primary workflow skill, `agents/*.md`, `skills/<skill>/SKILL.md`, `skills/<skill>/scripts/*`, and `docs/**`.
- Add a distinct helper for same-context sub-workflow command artifacts under Claude, for example `skills/<subworkflow-slug>/SKILL.md`, or inline sub-workflow content if no separate invocation is required. Whichever route is chosen, keep the output plugin-root-relative and command-free.
- Keep OpenCode/PI `buildGeneratedCommandFilePath` behavior byte-compatible.
- Update `src/lib/__tests__/generation-targets.test.ts` to cover new Claude plugin paths and reference paths, plus unchanged OpenCode/PI expectations.

### 4. Update Workflow Generation for Plugin Packaging
- In `src/lib/workflow-generator.ts`, branch on `target === "claude-code"` for package-level files.
- Generate the main workflow as `skills/run/SKILL.md`, not `commands/<workflow>.md`.
- Ensure the main skill contains the existing workflow execution guide/mermaid/details content but with skill frontmatter and `disable-model-invocation: true`.
- Include `.claude-plugin/plugin.json`, `README.md`, and `nexus/<workflow>.json` in Claude generated files.
- Ensure `nexus/<workflow>.json` content uses the same serialization shape as `getWorkflowExportContent(workflow)`.
- Skip `generateRunScriptFiles` for Claude target; keep run scripts for OpenCode and PI.
- Preserve recursive sub-workflow generation without producing `.claude` or `commands/` paths for Claude.
- Decide and implement same-context sub-workflow invocation text for Claude so generated instructions do not tell users to run a legacy `/<subworkflow>` command unless that sub-workflow is generated as a plugin skill.

### 5. Update Node Generators and Detail Sections for Plugin Resource References
- In `src/lib/workflow-generation/detail-sections.ts`, replace direct use of `getGenerationTarget(target).rootDir` for skill/doc references with the new resource reference helpers.
- In `src/nodes/agent/generator.ts`, use resource reference helpers for variable mappings (`doc:` and `skill:` refs) so Claude agent bodies reference `${CLAUDE_PLUGIN_ROOT}/docs/...` and `${CLAUDE_PLUGIN_ROOT}/skills/...`.
- In `src/nodes/skill/generator.ts`, update connected script instructions so Claude says to run scripts from `${CLAUDE_PLUGIN_ROOT}/skills/<skill>/scripts/...` or by changing into the plugin skill folder; keep OpenCode/PI existing command examples.
- In `src/nodes/sub-workflow/generator.ts`, update Claude sub-workflow agent body from `Call /<workflowSlug>` to the correct plugin skill invocation or bundled skill path.
- Verify `src/nodes/document/generator.ts` naturally emits root `docs/**` paths for Claude after path builder changes.

### 6. Update Browser Export ZIP and Folder Behavior
- In `src/lib/generated-workflow-export.ts`, add Claude-specific export behavior:
  - ZIP: add generated files exactly at ZIP root so `.claude-plugin/plugin.json` is at the ZIP root.
  - Direct folder: compute plugin folder name with `buildClaudePluginName(workflow.name)`.
  - If selected folder name equals the plugin name, write directly into selected folder.
  - Otherwise create/get a child directory named with the plugin name and write all generated files there.
  - Do not partition by `.claude` root for Claude.
- Preserve existing OpenCode/PI behavior, including writing generated files beneath `.opencode` or `.pi` and adding root-level run scripts.
- If practical, extract a pure helper for destination labels/plans and cover it in `src/lib/__tests__/generated-workflow-export.test.ts` without needing real browser directory handles.

### 7. Update Export UI Copy
- In `src/components/workflow/generated-export-dialog.tsx`, change Claude target copy from “writes into `.claude`” to “exports a Claude/Cowork plugin package”.
- Show the dynamic plugin folder name `nexus-<workflow-slug>` for the selected workflow when Claude is selected.
- For Claude direct folder export, explain that selecting a parent folder creates/updates `nexus-<workflow-slug>`, while selecting that plugin root writes directly into it.
- For Claude ZIP export, explain that `.claude-plugin/plugin.json` will be at ZIP root for Cowork custom upload compatibility.
- Ensure macOS hidden folder warning applies only to dot-folder targets (`.opencode`, `.pi`) and not Claude plugin folders.
- In `src/components/workflow/header/generate-menu.tsx`, update the Claude subtitle/root display so it does not show `.claude`.

### 8. Update Documentation and Changelog
- Update `README.md` export documentation:
  - Keep OpenCode/PI folder docs unchanged.
  - Replace Claude `.claude` output docs with Claude/Cowork plugin package docs.
  - Document generated Claude structure including `.claude-plugin/plugin.json`, `skills/run/SKILL.md`, `agents`, `skills`, `docs`, `nexus`, and `README.md`.
  - Document invocation as `/nexus-<workflow>:run`.
  - Clarify Claude exports do not include helper run scripts.
- Optionally add a top changelog entry in `src/lib/changelog.ts` if the app surfaces user-visible release notes for this change.

### 9. Create the E2E Test Specification File
- Create `docs/tasks/claude-plugin-export-for-cowork-ba5f56d5/e2e-claude-plugin-export-for-cowork-ba5f56d5.md` during implementation.
- Include this structure:
  - **User Story:** A workflow author can choose the Claude/Cowork Plugin target and see accurate ZIP/folder export guidance that does not mention writing to `.claude`.
  - **Test Steps:** Use `playwright-cli` to open the app, open the Generate menu, choose the Claude target, inspect the export dialog text, switch among OpenCode/PI/Claude targets, and verify the Claude target copy/folder labels update to plugin package language.
  - **Success Criteria:** Claude card/selected target shows plugin package language, no visible `.claude` output folder language for Claude, ZIP copy mentions Cowork/plugin compatibility, folder copy mentions `nexus-<workflow-slug>`, OpenCode/PI copy still mentions `.opencode`/`.pi`.
  - **Screenshot Capture Points:** initial Generate menu, Claude selected export dialog, folder target explanation, OpenCode/PI regression states.
- Do not execute the E2E test in implementation validation; a separate pipeline will run it.

### 10. Expand Regression Tests for Representative Output
- Update `src/nodes/parallel-agent/__tests__/generator.test.ts` expected Claude resource paths from `.claude/...` to `${CLAUDE_PLUGIN_ROOT}/...`.
- Update `src/lib/__tests__/run-script-generator.test.ts` to remove Claude run-script expectations and keep OpenCode/PI assertions.
- Add or update tests verifying OpenCode/PI generated file paths and run scripts are unchanged.
- In the new Claude plugin test, write generated Claude files into a temp directory and run:
  ```ts
  spawnSync("claude", ["plugin", "validate", tempPluginDir], { encoding: "utf8" })
  ```
  Assert exit code `0`; include stdout/stderr in failure messages. The task assumes Claude Code `2.1.126` is locally installed.
- If `claude --plugin-dir <temp-plugin-dir>` can be smoke-tested non-interactively, add a narrowly scoped test or documented manual command; otherwise keep this as a manual acceptance note to avoid hanging automated tests.

### 11. Run Validation Commands
- Execute every command in the `Validation Commands` section.
- Fix all failures before considering the task complete.

## Testing Strategy
### Unit Tests
- Helper tests for Claude plugin name sanitization/truncation and fallback behavior.
- Helper tests for plugin manifest shape and unsupported-field avoidance.
- Path builder tests for Claude plugin artifact paths and `${CLAUDE_PLUGIN_ROOT}` resource references.
- Full representative `generateWorkflowFiles(workflow, "claude-code")` tests for package layout, bundled resources, no `.claude`, no run scripts, and workflow JSON under `nexus/`.
- Regression tests proving OpenCode and PI paths, run scripts, and command files are unchanged.
- Export planning tests for Claude ZIP root and direct-folder plugin-root selection if pure helpers are extracted.
- Integration validation test using `claude plugin validate <temp-plugin-dir>` on generated files.

### Edge Cases
- Workflow names with spaces, punctuation, uppercase letters, underscores, repeated separators, or only invalid characters.
- Very long workflow names requiring 64-character plugin name truncation.
- Selected direct export directory already named exactly like the plugin root.
- ZIP export must not wrap files in an extra plugin folder.
- Workflows with no connected skills/docs/scripts still produce a valid plugin.
- Workflows with connected skills, scripts, docs, variable mappings, parallel-agent dynamic references, handoff nodes, and sub-workflows.
- Same-context sub-workflows must not generate legacy `commands/` or `.claude` paths for Claude.
- OpenCode/PI exports must still include command files and run scripts.
- Generated Claude plugin contents must not reference absolute local paths or paths outside `${CLAUDE_PLUGIN_ROOT}`.

## Acceptance Criteria
- Claude target generates a valid plugin package with `.claude-plugin/plugin.json` at package root.
- Claude target never generates `.claude/` file paths and generated content does not reference `.claude/`.
- Main workflow is generated as `skills/run/SKILL.md` with `disable-model-invocation: true`.
- Plugin invocation is documented as `/nexus-<workflow-slug>:run`.
- Generated agents, connected skills, scripts, documents, and Nexus workflow JSON are bundled inside the plugin root.
- Generated Claude references to bundled skills/docs/scripts use `${CLAUDE_PLUGIN_ROOT}/...`.
- Claude ZIP export places `.claude-plugin/plugin.json` at ZIP root.
- Claude direct folder export writes into `nexus-<workflow-slug>` unless the selected folder is already that plugin root.
- Claude exports do not include generated `run-*.sh` or `run-*.bat` scripts.
- OpenCode and PI export behavior remains unchanged.
- Export UI copy accurately describes Claude/Cowork plugin package behavior and no longer says Claude writes into `.claude`.
- `claude plugin validate` succeeds for a representative generated plugin package.
- E2E specification file exists at `docs/tasks/claude-plugin-export-for-cowork-ba5f56d5/e2e-claude-plugin-export-for-cowork-ba5f56d5.md` with user story, test steps, success criteria, and screenshot capture points.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

```bash
bun test src/lib/__tests__/claude-plugin-export.test.ts src/lib/__tests__/generation-targets.test.ts src/lib/__tests__/run-script-generator.test.ts src/nodes/parallel-agent/__tests__/generator.test.ts src/nodes/handoff/__tests__/generator.test.ts
npm run typecheck
npm run lint
npm run build
```

## Notes
- Do not add browser, Playwright, `playwright-cli`, or HTTP probe commands to validation; E2E execution is handled by a separate pipeline.
- Keep the target id `claude-code` unless there is a deliberate migration plan for persisted UI state and tests.
- The task assumes `claude plugin validate` is available locally; if validation fails due to manifest schema details, adjust the generated manifest to match the CLI validator rather than weakening the test.
- Marketplace parsing already understands `.claude-plugin/marketplace.json`; do not confuse a single-plugin export with a full marketplace repository generator in V1.

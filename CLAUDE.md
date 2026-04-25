# Nexus Workflow Studio

## Project summary

Nexus Workflow Studio is a **front-end-first** workflow editor built with Next.js, React, TypeScript, Zustand, React Flow, and Tailwind.

Primary product capabilities:
- Visual drag-and-drop workflow editing
- Nested sub-workflows
- Local library + JSON import/export
- Generated workflow artifacts for `OpenCode`, `PI`, and `Claude Code`
- Optional OpenCode integration for AI workflow generation, prompt generation, model discovery, tool discovery, and project switching

Persistence is primarily **browser `localStorage`**. Treat the app as client-heavy and avoid introducing backend assumptions unless the existing code already does so.

---

## Source of truth

Prefer these files over this document when details may drift:
- `package.json` — scripts, package manager, dependency versions
- `README.md` — user-facing product behavior and setup
- `CONTRIBUTING.md` — contribution and testing conventions
- `src/types/workflow.ts` — workflow/node types
- `src/lib/node-registry.ts` — registered node types and palette wiring
- `src/store/workflow-store.ts` and related `src/store/workflow*` files — workflow state behavior

Do **not** duplicate exact dependency versions or exhaustive file inventories here. If you need exact versions, read `package.json`.

---

## Quick start

Use Bun.

Common commands are defined in `package.json`. Typical ones include:
- `bun run dev`
- `bun run build`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- focused test commands such as `bun run test:lib`, `bun run test:store`, and `bun run test:nodes`

Before finishing non-trivial changes, prefer running:
1. targeted tests for the touched area
2. `bun run typecheck`
3. `bun run lint` when relevant
4. `bun run build` for changes that affect app wiring, exports, routing, or major UI flows

---

## Repo map

Keep the mental model high-level:

- `src/app/` — Next App Router entrypoints, layout, global CSS, lightweight routes
- `src/components/workflow/` — main editor UI, dialogs, panels, canvas shell
- `src/components/nodes/` — React Flow node renderers
- `src/components/ui/` — generated shadcn/ui primitives; avoid hand-editing unless regeneration is impossible
- `src/nodes/` — feature modules for each node type (schema, fields, generator, helpers)
- `src/store/` — Zustand stores and workflow-generation state
- `src/lib/` — cross-cutting utilities: persistence, generation, registries, validation, OpenCode client, marketplace helpers
- `src/hooks/` — reusable editor and data hooks
- `src/types/` — shared type definitions
- `docs/tasks/` — task-specific plans and notes
- `packages/` — auxiliary packages such as `nexus-acp-bridge` (see `packages/nexus-acp-bridge/CLAUDE.md` for package-scoped guidance)

---

## Architecture notes that matter

### Workflow editor
- The app centers on a React Flow canvas plus Zustand state.
- Canvas behavior, dialogs, the properties panel, and export flows are split across `src/components/workflow/`.
- Many user-visible changes require touching both UI code and store/helpers.

### Node system
- Node types are modular under `src/nodes/<type>/`.
- A node change often requires updates in more than one place:
  - `src/types/workflow.ts`
  - `src/lib/node-registry.ts`
  - the node module in `src/nodes/<type>/`
  - type-specific properties wiring under `src/components/workflow/properties/`
- The project currently supports more than the original 11 nodes; rely on current registry/types, not older docs.

### Generation/export system
- Workflow artifact generation lives under `src/lib/` and node generators.
- Export targets currently include `OpenCode`, `PI`, and `Claude Code`.
- Generated output names are sanitized from workflow or node names; preserve existing sanitization helpers rather than duplicating naming logic.

### OpenCode integration
- OpenCode support is optional.
- Keep offline/editor-only flows working even when OpenCode is disconnected.
- Client/service logic lives under `src/lib/opencode/`; related state lives under `src/store/opencode*`.

---

## Guardrails

### Imports and typing
- Use the `@/*` path alias for app code.
- Import Zod from `"zod/v4"`, not `"zod"`.
- Keep TypeScript strictness intact; avoid new `any` usage unless there is an established local pattern.

### UI and styling
- The app is dark-theme-first.
- Prefer existing theme tokens, utilities, and component patterns over ad hoc styling.
- Reuse existing workflow dialogs, sheets, and panels when extending UI behavior.

### Generated UI primitives
- `src/components/ui/` contains generated shadcn/ui files.
- Prefer composing them rather than rewriting them.
- If a new primitive is needed, generate it through the established shadcn flow instead of manually inventing inconsistent variants.

### Persistence and browser assumptions
- Be careful with `window`, `localStorage`, and browser-only APIs.
- Client components that use hooks/browser APIs must remain client components.
- Preserve import/export validation paths; invalid workflow data should fail safely.

### Keep docs durable
- When updating this file, keep it minimal and durable.
- Point readers to `package.json`, `README.md`, and `CONTRIBUTING.md` for details that change often.

---

## Known project pitfalls

- Use `NodeProps<Node<MyNodeData>>` for React Flow node components, not raw data types.
- `zodResolver` typing may require the existing local cast pattern in the properties form code; do not "simplify" it without verifying TypeScript behavior.
- React Flow deletion is intentionally controlled by app flows in parts of the editor; do not assume default key handling is always enabled.
- Export/generation behavior is spread across shared generators and node-specific generators; trace the full path before changing output format.
- Some old docs reference outdated node counts or structures. Check current source before making assumptions.

---

## If you add or change a node type

At minimum, inspect and update the relevant combination of:
- `src/types/workflow.ts`
- `src/lib/node-registry.ts`
- `src/nodes/<type>/`
- `src/components/workflow/properties/type-specific-fields.tsx`
- any generator/export helpers impacted by the node
- tests near `src/nodes/<type>/__tests__/` or shared coverage in `src/lib/__tests__/` / `src/store/__tests__/`

Do not stop after only adding the visual node component.

---

## Validation expectations

For meaningful code changes, validate with the smallest sufficient set of checks:
- file-level error check / TypeScript sanity
- focused tests for changed helpers or stores
- broader domain tests if shared behavior changed
- `bun run build` when wiring, routes, exports, or editor integration changed

If you change generated output formats, add or update regression tests for the exact emitted content.

---

## Good defaults for contributors and coding agents

- Make small, targeted changes.
- Preserve existing public APIs and file organization when possible.
- Prefer extending existing helpers over introducing duplicate utility layers.
- Follow established naming and module patterns in the surrounding folder.
- When unsure about behavior, inspect current usage sites before refactoring.

---

## Harness: Nexus Development

**Goal:** Automate multi-file feature development with analysis, implementation, and validation phases to ensure no touchpoints are missed.

**Agent Team:**
| Agent | Role |
|-------|------|
| nexus-analyst | Analyzes requirements, maps all affected files, creates implementation plan |
| nexus-builder | Implements code changes across all affected modules |
| nexus-validator | Runs typecheck/lint/tests, verifies cross-module consistency |

**Skills:**
| Skill | Purpose | Used By |
|-------|---------|---------|
| nexus-develop | Orchestrator — coordinates analyst → builder → validator pipeline | All agents |
| nexus-node-guide | Complete touchpoint guide for node type add/modify operations | nexus-analyst, nexus-builder |

**Execution Rules:**
- For feature implementation, bug fixes, refactoring, or any non-trivial code change, use the `nexus-develop` skill to coordinate the agent pipeline
- For node type operations specifically, the analyst and builder should also read `nexus-node-guide` for the full touchpoint chain
- Simple questions, explanations, or single-file trivial fixes can be handled directly without the harness
- All agents use `model: "opus"`
- Intermediate artifacts go in `_workspace/`

**Directory Structure:**
```
.claude/
├── agents/
│   ├── nexus-analyst.md
│   ├── nexus-builder.md
│   └── nexus-validator.md
└── skills/
    ├── nexus-develop/
    │   └── SKILL.md
    └── nexus-node-guide/
        └── SKILL.md
```

**Change History:**
| Date | Change | Target | Reason |
|------|--------|--------|--------|
| 2026-04-06 | Initial harness build | All | Fresh setup — 3-agent pipeline for multi-file development |

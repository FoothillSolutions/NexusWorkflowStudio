---
name: nexus-develop
description: "Orchestrates feature development, bug fixes, and refactoring for Nexus Workflow Studio using a 3-agent pipeline (analyst → builder → validator). Use this skill when the user asks to implement a feature, fix a bug, add a node type, modify the workflow editor, change generation/export behavior, update the store, or make any non-trivial code change to Nexus. Also triggers on: develop, implement, build, create, add, fix, refactor, update, modify, change. For follow-up work: re-run, redo, update result, improve, fix the implementation, try again, revise."
---

# Nexus Development Orchestrator

Coordinates the analyst → builder → validator pipeline for Nexus Workflow Studio development tasks.

## Execution Mode: Sub-agents

Three sequential sub-agents, each reading the previous agent's output from `_workspace/`.

## Agent Pipeline

| Phase | Agent | Type | Role | Output |
|-------|-------|------|------|--------|
| 1 | nexus-analyst | Plan | Map affected files, create implementation plan | `_workspace/01_analyst_plan.md` |
| 2 | nexus-builder | general-purpose | Implement code changes per plan | `_workspace/02_builder_changes.md` |
| 3 | nexus-validator | general-purpose | Run typecheck/lint/tests, verify completeness | `_workspace/03_validator_report.md` |

## Workflow

### Phase 0: Context Check

1. Check if `_workspace/` exists
2. Determine execution mode:
   - **No `_workspace/`** → Initial run. Create `_workspace/` and proceed to Phase 1
   - **`_workspace/` exists + user requests partial fix** → Partial re-run. Skip to the relevant agent (e.g., just re-run builder and validator if the plan was fine)
   - **`_workspace/` exists + new task** → New run. Move existing `_workspace/` to `_workspace_{timestamp}/`, create fresh `_workspace/`, proceed to Phase 1

### Phase 1: Analysis

Spawn the analyst agent:

```
Agent(
  prompt: "Read the user's request: {user_request}

  You are the nexus-analyst. Read your agent definition at .claude/agents/nexus-analyst.md, then:

  1. Understand the requirement
  2. Explore the codebase to map ALL affected files
  3. If this involves node types, read .claude/skills/nexus-node-guide/SKILL.md for the complete touchpoint guide
  4. Create _workspace/01_analyst_plan.md with your implementation plan

  {if previous plan exists: 'Previous plan exists at _workspace/01_analyst_plan.md. User feedback: {feedback}. Update the plan accordingly.'}",
  subagent_type: "Plan",
  model: "opus"
)
```

After the analyst completes, read `_workspace/01_analyst_plan.md` and present the plan to the user. Wait for approval before proceeding.

### Phase 2: Implementation

After user approves the plan, spawn the builder:

```
Agent(
  prompt: "You are the nexus-builder. Read your agent definition at .claude/agents/nexus-builder.md, then:

  1. Read the implementation plan at _workspace/01_analyst_plan.md
  2. Implement every change specified in the plan
  3. Save your change log to _workspace/02_builder_changes.md

  {if previous changes exist: 'Previous changes exist. User feedback: {feedback}. Make targeted fixes only.'}",
  subagent_type: "nexus-builder",
  model: "opus"
)
```

### Phase 3: Validation

After the builder completes, spawn the validator:

```
Agent(
  prompt: "You are the nexus-validator. Read your agent definition at .claude/agents/nexus-validator.md, then:

  1. Read the plan at _workspace/01_analyst_plan.md and changes at _workspace/02_builder_changes.md
  2. Run all validation steps (typecheck, lint, tests, cross-module consistency)
  3. Fix trivial issues yourself (< 5 lines)
  4. Save your report to _workspace/03_validator_report.md",
  subagent_type: "nexus-validator",
  model: "opus"
)
```

### Phase 4: Report

1. Read `_workspace/03_validator_report.md`
2. Present the validation results to the user
3. If FAIL: summarize what needs fixing and ask if the user wants to re-run the builder with feedback
4. If PASS: summarize what was done and confirm completion

## Error Handling

| Error | Action |
|-------|--------|
| Analyst can't determine scope | Ask user for clarification before spawning builder |
| Builder encounters unexpected file state | Report to user, do not force changes |
| Typecheck fails on new code | Re-run builder with specific error details (max 1 retry) |
| Tests fail | Report failures; let user decide whether to fix or accept |
| Pre-existing issues found | Note in report but do not block |

## Data Flow

```
User Request
    ↓
[Analyst] → _workspace/01_analyst_plan.md
    ↓ (user approval)
[Builder] → _workspace/02_builder_changes.md + actual code changes
    ↓
[Validator] → _workspace/03_validator_report.md
    ↓
Summary to User
```

## Test Scenarios

### Normal Flow
1. User: "Add a Loop node type that repeats its body N times"
2. Analyst maps: types/workflow.ts, node-types.ts, node-registry.ts, src/nodes/loop/*, components/nodes/loop-node.tsx, properties panel, generator, tests
3. Builder implements all files following the node module pattern
4. Validator: typecheck passes, lint passes, tests pass, all touchpoints covered → PASS

### Error Flow
1. User: "Fix the agent node color picker"
2. Analyst maps: src/nodes/agent/properties/color-picker.tsx
3. Builder makes the fix
4. Validator: typecheck fails — missing import in color-picker.tsx → fixes it automatically → re-runs typecheck → PASS
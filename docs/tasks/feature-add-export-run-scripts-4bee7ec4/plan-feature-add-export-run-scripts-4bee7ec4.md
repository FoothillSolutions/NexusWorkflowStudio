# feature: Add Run Scripts to Export

## Metadata
adw_id: `4bee7ec4`
issue_description: `There should be a run script/command as part of the export. Include run-<name>.sh and run-<name>.bat in every export so users can run the workflow against a code repo without touching the repo's existing .claude/.opencode config.`

## Description
NexusWorkflowStudio exports workflow files (.claude/commands/…, agents, skills, etc.) as a ZIP or direct folder write. Users want to copy/extract that export into a code repo and run the workflow against it without touching the repo's existing .claude/.opencode config. The solution is to include `run-<name>.sh` and `run-<name>.bat` in every export. The scripts capture the CWD (the code repo) before cd-ing to the extracted export dir (where .claude/ lives), then invoke the tool's CLI with a flag to allow operating on the repo root.

## Objective
When this plan is complete, every workflow export (both ZIP download and directory export) will include `run-<name>.sh` and `run-<name>.bat` scripts at the root level (outside the target root dir like `.claude/`). These scripts will allow users to run the exported workflow from their repository root without modifying the repo's existing tool configuration.

## Problem Statement
Currently, exported workflows only include files within the target root directory (e.g., `.claude/commands/`, `.claude/agents/`). Users must manually configure their tool setup or copy files into existing config directories to run the workflow. There is no convenient way to run an exported workflow against a code repo without touching its existing config.

## Solution Statement
1. Create a new `src/lib/run-script-generator.ts` module that generates bash and batch run scripts per generation target.
2. Modify `generateWorkflowFiles()` in `workflow-generator.ts` to include run scripts in its output.
3. Modify `exportGeneratedWorkflowToDirectory()` in `generated-workflow-export.ts` to partition root-level files (run scripts) from target-dir files and write them to the correct locations.

## Code Patterns to Follow
Reference implementations:
- `src/lib/generation-targets.ts` — pattern for target-specific configuration (CLI binary names, flags) via `Record<GenerationTargetId, ...>` maps
- `src/lib/workflow-generator.ts:615-626` — pattern for composing `GeneratedFile[]` from multiple sources in `generateWorkflowFiles()`
- `src/lib/generated-workflow-export.ts:108-121` — pattern for `stripTargetRootFromFiles()` which filters files by path prefix
- `src/lib/generated-workflow-export.ts:136-146` — pattern for directory export with resolved export destinations

## Relevant Files
Use these files to complete the task:

- **src/lib/generation-targets.ts** — Contains `GenerationTargetId`, `sanitizeGeneratedName()`, and target definitions. The new `TARGET_CLI` map will reference `GenerationTargetId` for CLI binary/flag configuration.
- **src/lib/workflow-generator.ts** — Contains `generateWorkflowFiles()` (line 615) which must be updated to include run script files in its return value. Also exports `GeneratedFile` interface used by the new module.
- **src/lib/generated-workflow-export.ts** — Contains `exportGeneratedWorkflowToDirectory()` (line 136) and `downloadGeneratedWorkflowZip()` (line 148). The directory export must partition root-level files from target-dir files. ZIP export needs no change (jszip handles root paths correctly).
- **.app_config.yaml** — App configuration with build/lint/typecheck commands for validation.

### New Files
- **src/lib/run-script-generator.ts** — New module responsible for generating run script content (bash `.sh` and batch `.bat`) per generation target.
- **docs/tasks/feature-add-export-run-scripts-4bee7ec4/e2e-feature-add-export-run-scripts-4bee7ec4.md** — E2E test file for validating run scripts appear in exports.

## Implementation Plan
### Phase 1: Foundation
Create the `run-script-generator.ts` module with:
- A `TARGET_CLI` record mapping each `GenerationTargetId` to its CLI binary name and `--add-dir` flag
- Bash template function generating `run-<name>.sh` content
- Batch template function generating `run-<name>.bat` content
- Exported `generateRunScriptFiles(workflowName, target)` function returning `GeneratedFile[]`

### Phase 2: Core Implementation
Integrate run script generation into the existing export pipeline:
- Import and call `generateRunScriptFiles()` in `workflow-generator.ts`'s `generateWorkflowFiles()` function
- Modify `exportGeneratedWorkflowToDirectory()` to partition root-level files (those without the target rootDir prefix) from target-dir files, writing each set to the correct directory handle

### Phase 3: Integration
- Verify ZIP download works correctly (jszip already handles root-level paths)
- Ensure directory export writes run scripts to the user-selected root, not inside the target subdirectory
- Validate that the generated scripts have correct content for all three targets (opencode, pi, claude-code)

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Create `src/lib/run-script-generator.ts`
- Create the new file with a `TARGET_CLI` record:
  ```typescript
  const TARGET_CLI: Record<GenerationTargetId, { bin: string; addDirFlag: string }> = {
    "claude-code": { bin: "claude", addDirFlag: "--add-dir" },
    opencode: { bin: "opencode", addDirFlag: "--add-dir" },
    pi: { bin: "pi", addDirFlag: "--add-dir" },
  };
  ```
- Implement bash template generating `run-<name>.sh`:
  ```bash
  #!/usr/bin/env bash
  # Generated by NexusWorkflowStudio
  # Run from your repository root: bash run-<name>.sh [args...]
  REPO_DIR="$(pwd)"
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR"
  exec <bin> <addDirFlag> "$REPO_DIR" "/<name>" "$@"
  ```
- Implement batch template generating `run-<name>.bat`:
  ```batch
  @echo off
  set REPO_DIR=%CD%
  set SCRIPT_DIR=%~dp0
  cd /d "%SCRIPT_DIR%"
  <bin> <addDirFlag> "%REPO_DIR%" "/<name>" %*
  ```
- Export `generateRunScriptFiles(workflowName: string, target: GenerationTargetId): GeneratedFile[]` that returns two files with root-level paths (no `.claude/` prefix): `run-<name>.sh` and `run-<name>.bat`

### 2. Integrate run scripts into `generateWorkflowFiles()`
- In `src/lib/workflow-generator.ts`, import `generateRunScriptFiles` from `@/lib/run-script-generator`
- At line 625, after collecting `agentFiles`, call `generateRunScriptFiles(safeName, target)` and spread the result into the return array:
  ```typescript
  const runScripts = generateRunScriptFiles(safeName, target);
  return [commandFile, ...agentFiles, ...runScripts];
  ```

### 3. Update directory export to handle root-level files
- In `src/lib/generated-workflow-export.ts`, add a `partitionByRoot()` helper function:
  ```typescript
  function partitionByRoot(
    files: GeneratedFile[],
    target: GenerationTargetId,
  ): { rootFiles: GeneratedFile[]; targetFiles: GeneratedFile[] } {
    const prefix = `${getGenerationTarget(target).rootDir}/`;
    const rootFiles = files.filter((f) => !f.path.startsWith(prefix));
    const targetFiles = files.filter((f) => f.path.startsWith(prefix));
    return { rootFiles, targetFiles };
  }
  ```
- Update `exportGeneratedWorkflowToDirectory()` to use `partitionByRoot()`:
  ```typescript
  export async function exportGeneratedWorkflowToDirectory(
    root: FileSystemDirectoryHandle,
    workflow: WorkflowJSON,
    target: GenerationTargetId,
  ): Promise<GeneratedFile[]> {
    const files = generateWorkflowFiles(workflow, target);
    const { rootFiles, targetFiles } = partitionByRoot(files, target);
    const destination = await resolveExportDirectory(root, target);
    await writeGeneratedFilesToDirectory(destination, stripTargetRootFromFiles(targetFiles, target));
    await writeGeneratedFilesToDirectory(root, rootFiles);
    return files;
  }
  ```
- No changes needed for `downloadGeneratedWorkflowZip()` — jszip places root-level paths at the ZIP root automatically.

### 4. Create E2E test specification
- Create `docs/tasks/feature-add-export-run-scripts-4bee7ec4/e2e-feature-add-export-run-scripts-4bee7ec4.md` with:
  - **User Story**: As a user, I want run scripts included in my workflow export so I can run the workflow from my repo root without modifying my existing tool config.
  - **Test Steps**:
    1. Navigate to the app at `http://localhost:3000`
    2. Create or open a workflow with at least one agent node connected between Start and End
    3. Name the workflow "Test Export Scripts"
    4. Open the generate/export dialog (`Ctrl+Alt+G`)
    5. Select "Claude Code" as the target
    6. Click "Download ZIP"
    7. Verify the downloaded ZIP contains `run-test-export-scripts.sh` and `run-test-export-scripts.bat` at the ZIP root alongside `.claude/`
    8. Verify `run-test-export-scripts.sh` contains `#!/usr/bin/env bash`, `exec claude --add-dir`, and `"/test-export-scripts"`
    9. Verify `run-test-export-scripts.bat` contains `@echo off`, `claude --add-dir`, and `"/test-export-scripts"`
    10. Take screenshot of ZIP contents
    11. Repeat steps 4-9 with "OpenCode" target, verify scripts reference `opencode` binary
    12. Repeat steps 4-9 with "PI" target, verify scripts reference `pi` binary
  - **Success Criteria**: Run scripts present at root level in ZIP for all three targets; scripts contain correct CLI binary, `--add-dir` flag, and workflow command name
  - **Screenshot capture points**: After ZIP download showing file listing; after opening each script showing content

### 5. Run validation commands
- Run `npm run build` to verify the build succeeds with zero errors
- Run `npm run typecheck` to verify type checking passes
- Run `npm run lint` to verify code quality

## Testing Strategy
### Unit Tests
- No test runner is currently configured for this project. Validation relies on build, typecheck, and lint checks.

### Edge Cases
- Workflow name with special characters: `sanitizeGeneratedName()` already handles this, producing clean filenames for run scripts
- User selects `.claude/` folder directly as export root: run scripts will land inside `.claude/` — acceptable edge case, same as current directory export behavior
- Sub-workflows: run scripts are only generated for the top-level `generateWorkflowFiles()` call, not for recursive sub-workflow generation (sub-workflows don't need separate run scripts since they're invoked from the parent)

## Acceptance Criteria
- `generateRunScriptFiles()` returns two `GeneratedFile` objects with paths `run-<name>.sh` and `run-<name>.bat` (no target rootDir prefix)
- `generateWorkflowFiles()` includes run scripts in its return value for all three targets
- ZIP download contains run scripts at the root level alongside the target directory
- Directory export writes run scripts to the user-selected root directory, not inside the target subdirectory
- Bash script contains correct shebang, REPO_DIR/SCRIPT_DIR resolution, and `exec <bin> <addDirFlag>` invocation
- Batch script contains correct `@echo off`, environment variable setup, and CLI invocation
- All three targets (claude-code, opencode, pi) produce scripts with the correct binary name
- `npm run build` passes with zero errors
- `npm run typecheck` passes with zero errors
- `npm run lint` passes with zero errors

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

```bash
npm run build
npm run typecheck
npm run lint
```

## Notes
- The `--add-dir` flag for `opencode` and `pi` CLIs should be verified against their actual documentation. The issue description assumes this flag exists for all three tools.
- The batch script does not use `exec` equivalent — it simply runs the command and returns its exit code.
- Run scripts are only generated at the top level, not for sub-workflow recursive generation. This is correct since sub-workflows are invoked by the parent workflow command.

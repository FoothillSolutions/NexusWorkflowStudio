# E2E Test: Add Run Scripts to Export

## User Story
As a user, I want run scripts included in my workflow export so I can run the workflow from my repo root without modifying my existing tool config.

## Test Steps

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

## Success Criteria
- Run scripts present at root level in ZIP for all three targets
- Scripts contain correct CLI binary, `--add-dir` flag, and workflow command name

## Screenshot Capture Points
- After ZIP download showing file listing
- After opening each script showing content

import { describe, expect, it } from "bun:test";

import {
  WORKFLOW_EXPORT_MARKER_PATH,
  generateRunScriptFiles,
} from "../run-script-generator";

describe("run-script-generator", () => {
  it("pipes the workflow path into claude for generated bash scripts", () => {
    const files = generateRunScriptFiles("untitled-workflow", "claude-code");
    const bashScript = files.find((file) => file.path === "run-untitled-workflow.sh");

    expect(bashScript?.content).toContain(
      `MARKER_FILE="$SCRIPT_DIR/${WORKFLOW_EXPORT_MARKER_PATH}"`,
    );
    expect(bashScript?.content).toContain(
      'COMMAND_FILE="$SCRIPT_DIR/.claude/commands/untitled-workflow.md"',
    );
    expect(bashScript?.content).toContain(
      'echo "/untitled-workflow" | claude --add-dir "$REPO_DIR" "$@"',
    );
    expect(bashScript?.content).not.toContain(
      'exec claude --add-dir "$REPO_DIR" "/untitled-workflow" "$@"',
    );
  });

  it("keeps batch scripts on positional arguments", () => {
    const files = generateRunScriptFiles("untitled-workflow", "claude-code");
    const batchScript = files.find((file) => file.path === "run-untitled-workflow.bat");

    expect(batchScript?.content).toContain(`set MARKER_FILE=%SCRIPT_DIR%${WORKFLOW_EXPORT_MARKER_PATH}`);
    expect(batchScript?.content).toContain(
      "set COMMAND_FILE=%SCRIPT_DIR%.claude\\commands\\untitled-workflow.md",
    );
    expect(batchScript?.content).toContain(
      'claude --add-dir "%REPO_DIR%" "/untitled-workflow" %*',
    );
  });

  it("uses the target CLI for other generated bash scripts", () => {
    const opencodeScript = generateRunScriptFiles("demo-workflow", "opencode").find(
      (file) => file.path === "run-demo-workflow.sh",
    );
    const piScript = generateRunScriptFiles("demo-workflow", "pi").find(
      (file) => file.path === "run-demo-workflow.sh",
    );

    expect(opencodeScript?.content).toContain(
      'echo "/demo-workflow" | opencode --add-dir "$REPO_DIR" "$@"',
    );
    expect(piScript?.content).toContain(
      'echo "/demo-workflow" | pi --add-dir "$REPO_DIR" "$@"',
    );
  });

  it("emits a bundle marker so runners do not accidentally use repo-local agent folders", () => {
    const marker = generateRunScriptFiles("demo-workflow", "opencode").find(
      (file) => file.path === WORKFLOW_EXPORT_MARKER_PATH,
    );

    expect(marker?.content).toContain("workflow=demo-workflow");
    expect(marker?.content).toContain("target=opencode");
    expect(marker?.content).toContain("rootDir=.opencode");
  });
});

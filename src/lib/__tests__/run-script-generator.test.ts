import { describe, expect, it } from "bun:test";

import { generateRunScriptFiles } from "../run-script-generator";

describe("run-script-generator", () => {
  it("does not generate helper run scripts for Claude plugin exports", () => {
    expect(generateRunScriptFiles("untitled-workflow", "claude-code")).toEqual([]);
  });

  it("pipes the workflow path into opencode for generated bash scripts", () => {
    const files = generateRunScriptFiles("untitled-workflow", "opencode");
    const bashScript = files.find((file) => file.path === "run-untitled-workflow.sh");

    expect(bashScript?.content).toContain(
      'echo "/untitled-workflow" | opencode --add-dir "$REPO_DIR" "$@"',
    );
    expect(bashScript?.content).not.toContain(
      'exec opencode --add-dir "$REPO_DIR" "/untitled-workflow" "$@"',
    );
  });

  it("keeps OpenCode and PI batch scripts on positional arguments", () => {
    const opencodeFiles = generateRunScriptFiles("untitled-workflow", "opencode");
    const piFiles = generateRunScriptFiles("untitled-workflow", "pi");
    const opencodeBatchScript = opencodeFiles.find((file) => file.path === "run-untitled-workflow.bat");
    const piBatchScript = piFiles.find((file) => file.path === "run-untitled-workflow.bat");

    expect(opencodeBatchScript?.content).toContain(
      'opencode --add-dir "%REPO_DIR%" "/untitled-workflow" %*',
    );
    expect(piBatchScript?.content).toContain(
      'pi --add-dir "%REPO_DIR%" "/untitled-workflow" %*',
    );
  });

  it("uses the target CLI for OpenCode and PI generated bash scripts", () => {
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
});

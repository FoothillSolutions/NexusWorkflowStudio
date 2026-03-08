import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupGeneratedPackage,
  createMockContext,
  createMockPi,
  importGeneratedModule,
  makeFullyWiredBranchWorkflow,
  makeMissingFalseHandleWorkflow,
  writeGeneratedPackage,
} from "./helpers/pi-extension-test-utils";

test("generated extension command path reports an errored run for an unwired branch handle", async () => {
  const rootDir = await writeGeneratedPackage(makeMissingFalseHandleWorkflow(), "pi-cli-smoke");

  try {
    const extensionModule = await importGeneratedModule<{ default: (pi: any) => void }>(
      rootDir,
      ".pi/extensions/nexus-workflow/index.ts"
    );

    const mockPi = createMockPi();
    const { ctx, notifications } = createMockContext(rootDir);

    extensionModule.default(mockPi.pi);
    await mockPi.emit("session_start", { source: "test" }, ctx);
    await mockPi.runCommand("wf-run", "flag=no", ctx);

    const started = notifications.find((entry) => entry.message.startsWith("Run "));
    assert.ok(started, "expected wf-run to report a started run");

    const runIdMatch = started.message.match(/^Run (\S+) started /);
    assert.ok(runIdMatch, `unable to extract runId from '${started.message}'`);
    const runId = runIdMatch[1];

    await mockPi.runCommand("wf-status", runId, ctx);

    const latest = notifications[notifications.length - 1];
    assert.ok(latest);
    assert.match(latest.message, new RegExp(`Run: ${runId}`));
    assert.match(latest.message, /Status: error/);
    assert.match(latest.message, /WF_TRANSITION_INVALID/);
  } finally {
    await cleanupGeneratedPackage(rootDir);
  }
});

test("generated extension command path reports a completed run for a valid branch selection", async () => {
  const rootDir = await writeGeneratedPackage(makeFullyWiredBranchWorkflow(), "pi-cli-success");

  try {
    const extensionModule = await importGeneratedModule<{ default: (pi: any) => void }>(
      rootDir,
      ".pi/extensions/nexus-workflow/index.ts"
    );

    const mockPi = createMockPi();
    const { ctx, notifications } = createMockContext(rootDir);

    extensionModule.default(mockPi.pi);
    await mockPi.emit("session_start", { source: "test" }, ctx);
    await mockPi.runCommand("wf-run", "flag=yes", ctx);

    const started = notifications.find((entry) => entry.message.startsWith("Run "));
    assert.ok(started, "expected wf-run to report a started run");

    const runIdMatch = started.message.match(/^Run (\S+) started /);
    assert.ok(runIdMatch, `unable to extract runId from '${started.message}'`);
    const runId = runIdMatch[1];

    await mockPi.runCommand("wf-status", runId, ctx);

    const latest = notifications[notifications.length - 1];
    assert.ok(latest);
    assert.match(latest.message, new RegExp(`Run: ${runId}`));
    assert.match(latest.message, /Status: done/);
    assert.match(latest.message, /Current node: none/);
  } finally {
    await cleanupGeneratedPackage(rootDir);
  }
});

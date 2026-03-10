import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupGeneratedPackage,
  createMockContext,
  createMockPi,
  generateFilesForTest,
  importGeneratedModule,
  makeMissingFalseHandleWorkflow,
  makeUnsupportedWorkflow,
  writeGeneratedPackage,
} from "./helpers/pi-extension-test-utils";

test("pi-extension export rejects reachable unsupported nodes", async () => {
  await assert.rejects(
    async () => generateFilesForTest(makeUnsupportedWorkflow()),
    /WF_NODE_UNSUPPORTED|unsupported for pi-extension export/
  );
});

test("generated runtime fails with WF_TRANSITION_INVALID when a requested branch handle is not wired", async () => {
  const rootDir = await writeGeneratedPackage(makeMissingFalseHandleWorkflow(), "pi-runtime-invalid-handle");

  try {
    const [{ WorkflowRegistry }, { WorkflowScheduler }] = await Promise.all([
      importGeneratedModule<{ WorkflowRegistry: new () => any }>(
        rootDir,
        ".pi/extensions/nexus-workflow/runtime/engine.ts"
      ),
      importGeneratedModule<{ WorkflowScheduler: new (pi: any, registry: any, defaultWorkflowId: string) => any }>(
        rootDir,
        ".pi/extensions/nexus-workflow/runtime/scheduler.ts"
      ),
    ]);

    const mockPi = createMockPi();
    const { ctx } = createMockContext(rootDir);
    const registry = new WorkflowRegistry();
    const scheduler = new WorkflowScheduler(mockPi.pi, registry, "missing-false-handle");

    await scheduler.initialize(ctx);
    const run = await scheduler.startRun("Missing False Handle", { flag: false }, ctx);

    assert.ok(run);
    assert.equal(run.status, "error");
    assert.equal(run.lastError?.code, "WF_TRANSITION_INVALID");
    assert.match(run.lastError?.message ?? "", /No transition found for handle 'false'/);
  } finally {
    await cleanupGeneratedPackage(rootDir);
  }
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createResearchSpace, deleteResearchSpace, getResearchSpace, getResearchStoragePaths, listResearchSpaces, saveResearchSpace, updateResearchSpaceMeta } from "@/lib/research/server";
import { resetWorkspaceConfigCache } from "@/lib/workspace/config";
import { createWorkspace } from "@/lib/workspace/server";

let dir = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-research-"));
  process.env.NEXUS_BRAIN_DATA_DIR = dir;
  resetWorkspaceConfigCache();
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.NEXUS_BRAIN_DATA_DIR;
  resetWorkspaceConfigCache();
});

describe("research server", () => {
  test("creates manifest, CRUDs spaces, and uses expected layout", async () => {
    expect(await listResearchSpaces("missing")).toBeNull();
    const workspace = await createWorkspace("Workspace");
    const created = await createResearchSpace(workspace.id, { name: "Research", templateId: "prd" });
    expect(created?.blocks.length).toBeGreaterThan(0);
    const paths = getResearchStoragePaths(workspace.id, created?.id);
    expect(paths.manifest).toContain(`workspaces/${workspace.id}/research/manifest.json`);
    expect(paths.space).toContain(`/research/spaces/${created?.id}.json`);
    expect((await listResearchSpaces(workspace.id))?.[0].blockCount).toBe(created?.blocks.length);
    const saved = await saveResearchSpace(workspace.id, created!.id, { ...created!, name: "Saved" }, "test");
    expect(saved?.name).toBe("Saved");
    expect((await getResearchSpace(workspace.id, created!.id))?.name).toBe("Saved");
    expect((await updateResearchSpaceMeta(workspace.id, created!.id, { name: "Meta" }))?.name).toBe("Meta");
    expect(await deleteResearchSpace(workspace.id, created!.id)).toBe(true);
  });
});

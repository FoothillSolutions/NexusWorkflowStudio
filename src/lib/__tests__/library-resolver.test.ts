import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  getLibraryStore,
  resetLibraryStoreForTests,
  resetLibraryConfigCache,
} from "@/lib/library-store";

let tempDir = "";

describe("library resolver", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-resolver-test-"));
    process.env.NEXUS_LIBRARY_DATA_DIR = tempDir;
    process.env.NEXUS_BRAIN_TOKEN_SECRET = "test-secret";
    resetLibraryStoreForTests();
    resetLibraryConfigCache();
  });

  afterEach(async () => {
    resetLibraryStoreForTests();
    resetLibraryConfigCache();
    delete process.env.NEXUS_LIBRARY_DATA_DIR;
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("draft live resolution returns current head", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries("ws", "user");
    const pack = await store.createPack(workspace.id, { packKey: "p", name: "P" });
    const { document } = await store.createDocument(pack.id, {
      role: "skill-entrypoint",
      path: "SKILL.md",
      content: "---\nname: x\ndescription: y\n---\nv1",
    });
    const skill = await store.createSkill(pack.id, { skillKey: "x", name: "X", description: "y", entrypointDocId: document.id });
    let bundle = await store.resolveLive({ scope: "workspace", packId: pack.id, packVersion: "draft", skillId: skill.id });
    expect(bundle?.entrypoint.content).toContain("v1");
    await store.saveDocumentVersion(document.id, { content: "---\nname: x\ndescription: y\n---\nv2", previousVersionId: document.currentVersionId });
    bundle = await store.resolveLive({ scope: "workspace", packId: pack.id, packVersion: "draft", skillId: skill.id });
    expect(bundle?.entrypoint.content).toContain("v2");
  });

  it("pinned version ignores subsequent draft edits", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries("ws", "user");
    const pack = await store.createPack(workspace.id, { packKey: "p", name: "P" });
    const { document } = await store.createDocument(pack.id, {
      role: "skill-entrypoint",
      path: "SKILL.md",
      content: "---\nname: x\ndescription: y\n---\nfrozen",
    });
    const skill = await store.createSkill(pack.id, { skillKey: "x", name: "X", description: "y", entrypointDocId: document.id });
    await store.publishPackVersion(pack.id, { version: "1.0.0" });
    await store.saveDocumentVersion(document.id, { content: "---\nname: x\ndescription: y\n---\nedited", previousVersionId: document.currentVersionId });
    const bundle = await store.resolveLive({ scope: "workspace", packId: pack.id, packVersion: "1.0.0", skillId: skill.id });
    expect(bundle?.entrypoint.content).toContain("frozen");
    expect(bundle?.entrypoint.content).not.toContain("edited");
  });
});

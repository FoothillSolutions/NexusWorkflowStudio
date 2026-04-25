import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  getLibraryStore,
  resetLibraryStoreForTests,
  resetLibraryConfigCache,
  buildNexusArchive,
  importNexusArchive,
  importAgentSkillsFolder,
} from "@/lib/library-store";

let tempDir = "";

describe("Nexus import", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-import-test-"));
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

  it("round-trips Nexus-native export + import", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries("ws-1", "user-1");
    const pack = await store.createPack(workspace.id, { packKey: "src", name: "Src" });
    const { document } = await store.createDocument(pack.id, {
      role: "skill-entrypoint",
      path: "SKILL.md",
      content: "---\nname: original\ndescription: original\n---\nbody",
    });
    const skill = await store.createSkill(pack.id, { skillKey: "original", name: "Original", description: "", entrypointDocId: document.id });

    const workflowJson = {
      nodes: [{ data: { libraryRef: { scope: "workspace", packId: pack.id, packKey: pack.packKey, packVersion: "draft", skillId: skill.id, skillKey: skill.skillKey } } }],
    };
    const { buffer } = await buildNexusArchive({ workflowJson, workflowName: "demo" });

    const result = await importNexusArchive({ buffer, workspaceId: "ws-2", scope: "workspace" });
    expect(result.packs).toHaveLength(1);
    const newPack = result.packs[0];
    const newSkills = await store.listSkills(newPack.id);
    expect(newSkills).toHaveLength(1);
    const docs = await store.listDocuments(newPack.id);
    const entrypoint = docs.find((d) => d.role === "skill-entrypoint");
    expect(entrypoint).toBeTruthy();
    const restoredContent = await store.readDocumentContent(entrypoint!.id, entrypoint!.currentVersionId);
    expect(restoredContent).toContain("body");
  });

  it("rejects archive with hash mismatch (FR-67)", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ schemaVersion: 1, workflowName: "x", createdAt: "", createdBy: "", resolverMode: "artifact", packs: [], skills: [] }));
    zip.file("workflow.json", "{}");
    zip.file("hashes.json", JSON.stringify({ "workflow.json": "wrong-hash", "manifest.json": "wrong-hash" }));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    await expect(importNexusArchive({ buffer, workspaceId: "ws-3", scope: "workspace" })).rejects.toThrow();
  });

  it("best-effort imports an Agent Skills zip with a single SKILL.md", async () => {
    const zip = new JSZip();
    zip.file("my-skill/SKILL.md", "---\nname: my-skill\ndescription: x\n---\nbody");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const result = await importAgentSkillsFolder({ buffer, workspaceId: "ws-4", packKey: "import-pack", scope: "user" });
    expect(result.packs).toHaveLength(1);
    const store = getLibraryStore();
    const skills = await store.listSkills(result.packs[0].id);
    expect(skills).toHaveLength(1);
  });
});

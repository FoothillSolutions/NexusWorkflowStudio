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
  computeContentHash,
  resolveFromArtifact,
} from "@/lib/library-store";

let tempDir = "";

describe("Nexus archive export", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-export-test-"));
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

  async function setupPackWithSkill() {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries("ws-x", "user-x");
    const pack = await store.createPack(workspace.id, { packKey: "support", name: "Support" });
    const { document } = await store.createDocument(pack.id, {
      role: "skill-entrypoint",
      path: "SKILL.md",
      content: "---\nname: triage\ndescription: tri\n---\nbody",
    });
    const skill = await store.createSkill(pack.id, { skillKey: "triage", name: "Triage", description: "tri", entrypointDocId: document.id });
    return { pack, skill };
  }

  it("builds a .nexus archive containing workflow + packs + hashes (AC-10)", async () => {
    const { pack, skill } = await setupPackWithSkill();
    const workflowJson = {
      name: "demo",
      nodes: [
        {
          id: "n1",
          type: "skill",
          position: { x: 0, y: 0 },
          data: {
            type: "skill",
            label: "Skill",
            name: "n1",
            skillName: "triage",
            description: "",
            promptText: "",
            detectedVariables: [],
            variableMappings: {},
            metadata: [],
            libraryRef: { scope: "workspace", packId: pack.id, packKey: pack.packKey, packVersion: "draft", skillId: skill.id, skillKey: skill.skillKey },
          },
        },
      ],
      edges: [],
    };
    const { buffer, archiveName } = await buildNexusArchive({ workflowJson, workflowName: "demo" });
    expect(archiveName.endsWith(".nexus")).toBe(true);
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file("workflow.json")).toBeTruthy();
    expect(zip.file("hashes.json")).toBeTruthy();
    expect(zip.file("runtime/resolver-metadata.json")).toBeTruthy();
    expect(zip.file(`libraries/workspace/packs/${pack.packKey}/skills/${skill.skillKey}/SKILL.md`)).toBeTruthy();
  });

  it("hash validation round-trip succeeds (AC-10, FR-65)", async () => {
    const { pack, skill } = await setupPackWithSkill();
    const workflowJson = {
      nodes: [
        {
          data: {
            libraryRef: { scope: "workspace", packId: pack.id, packKey: pack.packKey, packVersion: "draft", skillId: skill.id, skillKey: skill.skillKey },
          },
        },
      ],
    };
    const { buffer } = await buildNexusArchive({ workflowJson, workflowName: "demo" });
    const zip = await JSZip.loadAsync(buffer);
    const hashes = JSON.parse(await zip.file("hashes.json")!.async("string"));
    for (const [key, expected] of Object.entries(hashes)) {
      const file = zip.file(key);
      expect(file).toBeTruthy();
      const content = await file!.async("string");
      expect(computeContentHash(content)).toBe(expected as string);
    }
  });

  it("resolves from artifact without live library (AC-11)", async () => {
    const { pack, skill } = await setupPackWithSkill();
    const workflowJson = {
      nodes: [{ data: { libraryRef: { scope: "workspace", packId: pack.id, packKey: pack.packKey, packVersion: "draft", skillId: skill.id, skillKey: skill.skillKey } } }],
    };
    const { buffer } = await buildNexusArchive({ workflowJson, workflowName: "demo" });
    const zip = await JSZip.loadAsync(buffer);
    const resolverMetadata = JSON.parse(await zip.file("runtime/resolver-metadata.json")!.async("string"));
    const files = new Map<string, string>();
    for (const filename of Object.keys(zip.files)) {
      if (zip.files[filename].dir) continue;
      files.set(filename, await zip.file(filename)!.async("string"));
    }
    const bundle = resolveFromArtifact(
      { scope: "workspace", packId: pack.id, packVersion: "draft", skillId: skill.id },
      { manifest: { schemaVersion: 1, packs: [] }, resolverMetadata: resolverMetadata.entries, files },
    );
    expect(bundle).not.toBeNull();
    expect(bundle?.entrypoint.content).toContain("body");
  });
});

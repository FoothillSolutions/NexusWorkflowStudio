import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  getLibraryStore,
  resetLibraryStoreForTests,
  resetLibraryConfigCache,
  StaleVersionError,
} from "@/lib/library-store";

let tempDir = "";
const WORKSPACE_ID = "ws-test-123";
const USER_ID = "user-test-1";

describe("LibraryStore", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-library-test-"));
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

  it("creates workspace and user libraries", async () => {
    const store = getLibraryStore();
    const { workspace, user } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    expect(workspace.scope).toBe("workspace");
    expect(user?.scope).toBe("user");
    const again = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    expect(again.workspace.id).toBe(workspace.id);
    expect(again.user?.id).toBe(user?.id);
  });

  it("createPackWithTwoSkills (AC-1)", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "support", name: "Support" });
    const { document: skillADoc } = await store.createDocument(pack.id, {
      role: "skill-entrypoint",
      path: "support-triage/SKILL.md",
      content: "# Triage",
    });
    const { document: skillBDoc } = await store.createDocument(pack.id, {
      role: "skill-entrypoint",
      path: "support-escalate/SKILL.md",
      content: "# Escalate",
    });
    const { document: refDoc } = await store.createDocument(pack.id, {
      role: "reference",
      path: "references/policy.md",
      content: "# policy",
    });
    await store.createSkill(pack.id, { skillKey: "support-triage", name: "Triage", description: "", entrypointDocId: skillADoc.id });
    await store.createSkill(pack.id, { skillKey: "support-escalate", name: "Escalate", description: "", entrypointDocId: skillBDoc.id });
    const skills = await store.listSkills(pack.id);
    expect(skills).toHaveLength(2);
    const docs = await store.listDocuments(pack.id);
    expect(docs.find((d) => d.id === refDoc.id)?.path).toBe("references/policy.md");
  });

  it("rejects stale previousVersionId on saveDocumentVersion (FR-14)", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "p", name: "P" });
    const { document } = await store.createDocument(pack.id, { role: "doc", path: "a.md", content: "v1" });
    await store.saveDocumentVersion(document.id, { content: "v2", previousVersionId: document.currentVersionId });
    await expect(
      store.saveDocumentVersion(document.id, { content: "v3", previousVersionId: document.currentVersionId }),
    ).rejects.toBeInstanceOf(StaleVersionError);
  });

  it("versionSnapshot persists content under documents/{id}/versions/{v}/content.md (AC-4)", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "p", name: "P" });
    const { document, version } = await store.createDocument(pack.id, { role: "doc", path: "a.md", content: "hello" });
    const filePath = path.join(tempDir, "objects", "documents", document.id, "versions", version.id, "content.md");
    const content = await fs.readFile(filePath, "utf8");
    expect(content).toBe("hello");
  });

  it("forks pack and copies skill+document rows with base_version_id (AC-2)", async () => {
    const store = getLibraryStore();
    const { workspace, user } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "src", name: "Src" });
    const { document } = await store.createDocument(pack.id, { role: "skill-entrypoint", path: "SKILL.md", content: "src content" });
    await store.createSkill(pack.id, { skillKey: "src", name: "Src", description: "", entrypointDocId: document.id });
    const fork = await store.forkPack(pack.id, user!.id);
    expect(fork.basePackId).toBe(pack.id);
    const forkDocs = await store.listDocuments(fork.id);
    expect(forkDocs.some((d) => d.path === "SKILL.md")).toBe(true);
    const forkSkills = await store.listSkills(fork.id);
    expect(forkSkills).toHaveLength(1);
  });

  it("merges base into fork cleanly (AC-5)", async () => {
    const store = getLibraryStore();
    const { workspace, user } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "src", name: "Src" });
    const { document } = await store.createDocument(pack.id, { role: "doc", path: "a.md", content: "line1\nline2\n" });
    const fork = await store.forkPack(pack.id, user!.id);

    await store.saveDocumentVersion(document.id, { content: "line1\nline2\nline3\n", previousVersionId: document.currentVersionId });
    const merge = await store.mergeBaseIntoBranch(fork.id);
    expect(merge.status).toBe("clean");
    const forkDocs = await store.listDocuments(fork.id);
    const forkDoc = forkDocs.find((d) => d.path === "a.md");
    const updated = await store.readDocumentContent(forkDoc!.id, forkDoc!.currentVersionId);
    expect(updated).toBe("line1\nline2\nline3\n");
  });

  it("merge with same-line conflict creates document_merges + document_conflicts (AC-6)", async () => {
    const store = getLibraryStore();
    const { workspace, user } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "src", name: "Src" });
    const { document } = await store.createDocument(pack.id, { role: "doc", path: "a.md", content: "shared\n" });
    const fork = await store.forkPack(pack.id, user!.id);
    const forkDocs = await store.listDocuments(fork.id);
    const forkDoc = forkDocs.find((d) => d.path === "a.md")!;

    await store.saveDocumentVersion(document.id, { content: "base-edit\n", previousVersionId: document.currentVersionId });
    await store.saveDocumentVersion(forkDoc.id, { content: "fork-edit\n", previousVersionId: forkDoc.currentVersionId });

    const merge = await store.mergeBaseIntoBranch(fork.id);
    expect(merge.status).toBe("conflict");
    expect(merge.conflictDocs.length).toBeGreaterThan(0);
    const conflicts = await store.listConflicts(merge.id);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("resolveMergeConflict updates branch head (FR-27)", async () => {
    const store = getLibraryStore();
    const { workspace, user } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "src", name: "Src" });
    const { document } = await store.createDocument(pack.id, { role: "doc", path: "a.md", content: "shared\n" });
    const fork = await store.forkPack(pack.id, user!.id);
    const forkDocs = await store.listDocuments(fork.id);
    const forkDoc = forkDocs.find((d) => d.path === "a.md")!;
    await store.saveDocumentVersion(document.id, { content: "X\n", previousVersionId: document.currentVersionId });
    await store.saveDocumentVersion(forkDoc.id, { content: "Y\n", previousVersionId: forkDoc.currentVersionId });

    const merge = await store.mergeBaseIntoBranch(fork.id);
    const resolved = await store.resolveMergeConflict(merge.id, { resolvedContentByDocId: { [forkDoc.id]: "merged\n" }, resolvedBy: "user" });
    expect(resolved.status).toBe("resolved");
    const refreshed = await store.listDocuments(fork.id);
    const refreshedDoc = refreshed.find((d) => d.id === forkDoc.id)!;
    const finalContent = await store.readDocumentContent(refreshedDoc.id, refreshedDoc.currentVersionId);
    expect(finalContent).toBe("merged\n");
  });

  it("publishes pack version snapshotting current doc heads (AC-7, FR-42)", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "p", name: "P" });
    const { document } = await store.createDocument(pack.id, { role: "skill-entrypoint", path: "SKILL.md", content: "---\nname: x\ndescription: y\n---\n" });
    await store.createSkill(pack.id, { skillKey: "x", name: "X", description: "y", entrypointDocId: document.id });
    const pv = await store.publishPackVersion(pack.id, { version: "1.0.0" });
    expect(pv.version).toBe("1.0.0");
    const manifestPath = path.join(tempDir, "objects", "packs", pack.id, "versions", pv.id, "manifest.json");
    const exists = await fs.stat(manifestPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("publishes skill version snapshotting closure (AC-8, FR-43)", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "p", name: "P" });
    const { document } = await store.createDocument(pack.id, { role: "skill-entrypoint", path: "SKILL.md", content: "---\nname: x\ndescription: y\n---\n" });
    const skill = await store.createSkill(pack.id, { skillKey: "x", name: "X", description: "y", entrypointDocId: document.id });
    const sv = await store.publishSkillVersion(skill.id, { version: "0.1.0" });
    const list = await store.listSkillVersions(skill.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(sv.id);
  });

  it("resolveLive returns SkillBundle for draft and pinned version", async () => {
    const store = getLibraryStore();
    const { workspace } = await store.ensureLibraries(WORKSPACE_ID, USER_ID);
    const pack = await store.createPack(workspace.id, { packKey: "p", name: "P" });
    const { document } = await store.createDocument(pack.id, { role: "skill-entrypoint", path: "SKILL.md", content: "---\nname: x\ndescription: y\n---\nbody-1\n" });
    const skill = await store.createSkill(pack.id, { skillKey: "x", name: "X", description: "y", entrypointDocId: document.id });
    const draft = await store.resolveLive({ scope: "workspace", packId: pack.id, packVersion: "draft", skillId: skill.id });
    expect(draft?.entrypoint.content).toContain("body-1");
    const pv = await store.publishPackVersion(pack.id, { version: "1.0.0" });
    await store.saveDocumentVersion(document.id, { content: "---\nname: x\ndescription: y\n---\nbody-2\n", previousVersionId: document.currentVersionId });
    const pinned = await store.resolveLive({ scope: "workspace", packId: pack.id, packVersion: "1.0.0", skillId: skill.id });
    expect(pinned?.entrypoint.content).toContain("body-1");
    expect(pv.id).toBeTruthy();
  });
});

import { describe, expect, it, beforeEach, mock } from "bun:test";

const originalFetch = globalThis.fetch;

describe("useLibraryDocsStore", () => {
  beforeEach(() => {
    mock.module("@/lib/library-client", () => ({
      libraryBootstrap: async () => ({ workspaceId: "ws-1", ownerUserId: null, libraries: [] }),
      listPacksForScope: async () => [],
      createPack: async () => ({ id: "p1", libraryId: "l1", packKey: "p", name: "P" }),
      forkPack: async () => ({ id: "f1", libraryId: "l2", packKey: "p-fork" }),
      softDeletePack: async () => undefined,
      listDocuments: async () => [],
      listSkills: async () => [],
      listPackVersions: async () => [],
      listSkillVersions: async () => [],
      createDocument: async () => ({ document: { id: "d1", currentVersionId: "v1" }, version: { id: "v1" } }),
      saveDocumentVersion: async () => ({ id: "v2" }),
      deleteDocument: async () => undefined,
      getDocumentVersionContent: async () => "content",
      createSkill: async () => ({ id: "s1" }),
      deleteSkill: async () => undefined,
      publishPackVersion: async () => ({ id: "pv1", version: "1.0.0" }),
      publishSkillVersion: async () => ({ id: "sv1", version: "1.0.0" }),
      mergeBaseIntoBranch: async () => ({ id: "m1", status: "clean", conflictDocs: [], mergedCleanlyDocs: [] }),
      listMergeConflicts: async () => [],
      resolveMergeConflict: async () => ({ id: "m1", status: "resolved" }),
      validatePack: async () => [],
      resolveLiveSkill: async () => null,
      exportNexusArchive: async () => new Blob(),
      importNexusArchive: async () => [],
      listDocumentVersions: async () => [],
    }));
  });

  it("bootstrap sets workspaceId and marks bootstrapped", async () => {
    const { useLibraryDocsStore } = await import("@/store/library-docs/store");
    await useLibraryDocsStore.getState().bootstrap();
    expect(useLibraryDocsStore.getState().bootstrapped).toBe(true);
    expect(useLibraryDocsStore.getState().workspaceId).toBe("ws-1");
  });

  it("createPack invokes API and triggers refresh", async () => {
    const { useLibraryDocsStore } = await import("@/store/library-docs/store");
    await useLibraryDocsStore.getState().bootstrap();
    const pack = await useLibraryDocsStore.getState().createPack("workspace", "p", "P");
    expect(pack.id).toBe("p1");
  });

  it("selectPack updates state", async () => {
    const { useLibraryDocsStore } = await import("@/store/library-docs/store");
    useLibraryDocsStore.getState().selectPack("p1");
    expect(useLibraryDocsStore.getState().selectedPackId).toBe("p1");
  });

  it("mergeBase records pending merge", async () => {
    const { useLibraryDocsStore } = await import("@/store/library-docs/store");
    const merge = await useLibraryDocsStore.getState().mergeBase("p1");
    expect(merge.status).toBe("clean");
    expect(useLibraryDocsStore.getState().pendingMerges["p1"].id).toBe("m1");
  });
});

if (originalFetch) globalThis.fetch = originalFetch;

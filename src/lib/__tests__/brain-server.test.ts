import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createShareToken, getBrainStore, resetBrainStoreForTests } from "../brain/server";
import { resetBrainConfigCache } from "../brain/config";
import type { KnowledgeBrain } from "@/types/knowledge";

let tempDir = "";

describe("BrainStore", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-brain-test-"));
    process.env.NEXUS_BRAIN_DATA_DIR = tempDir;
    process.env.NEXUS_BRAIN_TOKEN_SECRET = "test-secret";
    resetBrainStoreForTests();
    resetBrainConfigCache();
  });

  afterEach(async () => {
    resetBrainStoreForTests();
    resetBrainConfigCache();
    delete process.env.NEXUS_BRAIN_DATA_DIR;
    delete process.env.NEXUS_BRAIN_TOKEN_SECRET;
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("migrates legacy brain docs into file-backed storage without losing metadata", async () => {
    const exportedDoc = {
      id: "doc-1",
      title: "Runbook",
      summary: "Keep original metadata",
      content: "content",
      docType: "runbook" as const,
      tags: ["ops"],
      associatedWorkflowIds: ["wf-1"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      createdBy: "alice",
      status: "active" as const,
      metrics: {
        views: 7,
        lastViewedAt: "2026-01-03T00:00:00.000Z",
        feedback: [
          {
            id: "fb-1",
            rating: "success" as const,
            note: "worked",
            author: "bob",
            at: "2026-01-04T00:00:00.000Z",
          },
        ],
      },
    };
    const legacyBrain: KnowledgeBrain = {
      version: "1",
      exportedAt: "2026-01-05T00:00:00.000Z",
      docs: [exportedDoc],
    };

    const session = await getBrainStore().createOrResumeSession(null, legacyBrain);
    expect(session.docs).toHaveLength(1);
    expect(session.docs[0]).toEqual(exportedDoc);

    const versions = await getBrainStore().listVersions(session.workspaceId, exportedDoc.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.reason).toBe("migration");

    const liveFile = path.join(tempDir, "live", session.workspaceId, `${exportedDoc.id}.json`);
    const storedDoc = JSON.parse(await fs.readFile(liveFile, "utf8"));
    expect(storedDoc).toEqual(exportedDoc);
  });

  it("preserves imported timestamps and metrics when saving imported docs", async () => {
    const session = await getBrainStore().createOrResumeSession(null, null);
    const saved = await getBrainStore().saveDoc(session.workspaceId, {
      id: "imported-doc",
      title: "Imported",
      summary: "from backup",
      content: "restored",
      docType: "guide",
      status: "draft",
      createdBy: "importer",
      tags: ["backup"],
      associatedWorkflowIds: [],
      createdAt: "2025-12-01T00:00:00.000Z",
      updatedAt: "2025-12-02T00:00:00.000Z",
      metrics: {
        views: 3,
        lastViewedAt: "2025-12-03T00:00:00.000Z",
        feedback: [],
      },
      versionReason: "import",
    });

    expect(saved.createdAt).toBe("2025-12-01T00:00:00.000Z");
    expect(saved.updatedAt).toBe("2025-12-02T00:00:00.000Z");
    expect(saved.metrics.views).toBe(3);

    const versions = await getBrainStore().listVersions(session.workspaceId, "imported-doc");
    expect(versions[0]?.reason).toBe("import");
  });

  it("resumes the same workspace from a share token", async () => {
    const session = await getBrainStore().createOrResumeSession(null, null);
    const shareToken = createShareToken(session.workspaceId);

    const resumed = await getBrainStore().createOrResumeSession(shareToken, null);

    expect(resumed.workspaceId).toBe(session.workspaceId);
    expect(resumed.token).toBe(shareToken);
  });
});

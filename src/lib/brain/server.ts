import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { customAlphabet } from "nanoid";
import { getBrainConfig } from "./config";
import { getStorageProvider } from "@/lib/storage";
import type {
  BrainManifest,
  BrainDocumentRecord,
  BrainDocumentVersionRecord,
  BrainWorkspaceRecord,
  SaveBrainDocInput,
} from "./types";
import type {
  BrainSession,
  KnowledgeBrain,
  KnowledgeDoc,
  KnowledgeDocVersion,
  KnowledgeFeedback,
  KnowledgeVersionReason,
} from "@/types/knowledge";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const MANIFEST_FILE = "manifest.json";

function nowIso(): string {
  return new Date().toISOString();
}

function storage() {
  return getStorageProvider();
}

function createEmptyManifest(): BrainManifest {
  return {
    version: 1,
    workspaces: [],
    documents: [],
    versions: [],
    feedback: [],
  };
}

function toVersionSummary(doc: KnowledgeDoc): string {
  return doc.summary.trim()
    || doc.content.trim().slice(0, 140)
    || doc.title;
}

async function readJsonKey<T>(key: string, fallback: T): Promise<T> {
  const raw = await storage().read(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonKey(key: string, value: unknown): Promise<void> {
  await storage().write(key, JSON.stringify(value, null, 2));
}

function signValue(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeToken(secret: string, payload: Record<string, string>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signValue(secret, body);
  return `${body}.${signature}`;
}

function decodeToken(secret: string, token: string): Record<string, string> | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(signValue(secret, body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

export class BrainStore {
  private readonly tokenSecret = getBrainConfig().tokenSecret;

  private manifestKey(): string {
    return MANIFEST_FILE;
  }

  private liveDocKey(workspaceId: string, docId: string): string {
    return `live/${workspaceId}/${docId}.json`;
  }

  private versionKey(workspaceId: string, docId: string, versionId: string): string {
    return `versions/${workspaceId}/${docId}/${versionId}.json`;
  }

  private async readManifest(): Promise<BrainManifest> {
    return readJsonKey(this.manifestKey(), createEmptyManifest());
  }

  private async writeManifest(manifest: BrainManifest): Promise<void> {
    await writeJsonKey(this.manifestKey(), manifest);
  }

  private toPublicDoc(doc: BrainDocumentRecord): KnowledgeDoc {
    const { workspaceId: _workspaceId, deletedAt: _deletedAt, ...publicDoc } = doc;
    return publicDoc;
  }

  private sortDocs(docs: BrainDocumentRecord[]): BrainDocumentRecord[] {
    return [...docs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  private async createVersion(
    manifest: BrainManifest,
    workspaceId: string,
    doc: KnowledgeDoc,
    reason: KnowledgeVersionReason,
    createdBy: string,
  ): Promise<BrainDocumentVersionRecord> {
    const versionId = nanoid();
    const snapshotKey = this.versionKey(workspaceId, doc.id, versionId);
    await writeJsonKey(snapshotKey, doc);

    const version: BrainDocumentVersionRecord = {
      id: versionId,
      workspaceId,
      docId: doc.id,
      createdAt: nowIso(),
      createdBy,
      reason,
      summary: toVersionSummary(doc),
      snapshotKey,
    };
    manifest.versions.unshift(version);
    return version;
  }

  private buildSession(workspace: BrainWorkspaceRecord, docs: BrainDocumentRecord[]): BrainSession {
    return {
      workspaceId: workspace.id,
      token: encodeToken(this.tokenSecret, { workspaceId: workspace.id, role: "owner" }),
      docs: this.sortDocs(docs)
        .filter((doc) => doc.deletedAt === null)
        .map((doc) => this.toPublicDoc(doc)),
    };
  }

  async createOrResumeSession(
    token: string | null,
    legacyBrain?: KnowledgeBrain | null,
  ): Promise<BrainSession> {
    const manifest = await this.readManifest();

    if (token) {
      const payload = decodeToken(this.tokenSecret, token);
      if (payload?.workspaceId) {
        const workspace = manifest.workspaces.find((item) => item.id === payload.workspaceId);
        if (workspace) {
          return {
            ...this.buildSession(
              workspace,
              manifest.documents.filter((doc) => doc.workspaceId === workspace.id),
            ),
            token,
          };
        }
      }
    }

    const createdAt = nowIso();
    const workspace: BrainWorkspaceRecord = {
      id: nanoid(),
      createdAt,
      updatedAt: createdAt,
    };
    manifest.workspaces.push(workspace);

    if (legacyBrain?.docs?.length) {
      for (const imported of legacyBrain.docs) {
        const doc: BrainDocumentRecord = {
          ...imported,
          workspaceId: workspace.id,
          deletedAt: null,
        };
        manifest.documents.push(doc);
        await writeJsonKey(this.liveDocKey(workspace.id, doc.id), this.toPublicDoc(doc));
        await this.createVersion(
          manifest,
          workspace.id,
          this.toPublicDoc(doc),
          "migration",
          doc.createdBy || "migration",
        );
      }
    }

    await this.writeManifest(manifest);
    return this.buildSession(workspace, manifest.documents.filter((doc) => doc.workspaceId === workspace.id));
  }

  async listDocs(workspaceId: string): Promise<KnowledgeDoc[]> {
    const manifest = await this.readManifest();
    return this.sortDocs(
      manifest.documents.filter((doc) => doc.workspaceId === workspaceId && doc.deletedAt === null),
    ).map((doc) => this.toPublicDoc(doc));
  }

  async saveDoc(workspaceId: string, input: SaveBrainDocInput): Promise<KnowledgeDoc> {
    const manifest = await this.readManifest();
    const existingIndex = manifest.documents.findIndex(
      (doc) => doc.workspaceId === workspaceId && doc.id === input.id,
    );

    const existing = existingIndex >= 0 ? manifest.documents[existingIndex] : null;
    const now = nowIso();
    const isImport = input.versionReason === "import"
      || Boolean(input.createdAt)
      || Boolean(input.updatedAt)
      || Boolean(input.metrics);
    const createdAt = existing?.createdAt ?? input.createdAt ?? now;
    const updatedAt = isImport ? (input.updatedAt ?? createdAt) : now;
    const doc: BrainDocumentRecord = {
      id: existing?.id ?? input.id ?? nanoid(),
      workspaceId,
      title: input.title,
      summary: input.summary,
      content: input.content,
      docType: input.docType,
      tags: [...input.tags],
      associatedWorkflowIds: [...input.associatedWorkflowIds],
      createdAt,
      updatedAt,
      createdBy: existing?.createdBy || input.createdBy || "",
      status: input.status,
      metrics: input.metrics ?? existing?.metrics ?? { views: 0, lastViewedAt: null, feedback: [] },
      deletedAt: null,
    };

    if (existingIndex >= 0) {
      manifest.documents[existingIndex] = doc;
    } else {
      manifest.documents.unshift(doc);
    }

    await writeJsonKey(this.liveDocKey(workspaceId, doc.id), this.toPublicDoc(doc));
    await this.createVersion(
      manifest,
      workspaceId,
      this.toPublicDoc(doc),
      input.versionReason ?? (isImport ? "import" : "save"),
      input.createdBy || doc.createdBy || "",
    );
    await this.writeManifest(manifest);
    return this.toPublicDoc(doc);
  }

  async deleteDoc(workspaceId: string, docId: string): Promise<boolean> {
    const manifest = await this.readManifest();
    const doc = manifest.documents.find(
      (item) => item.workspaceId === workspaceId && item.id === docId && item.deletedAt === null,
    );
    if (!doc) return false;

    doc.deletedAt = nowIso();
    doc.updatedAt = doc.deletedAt;
    await this.createVersion(
      manifest,
      workspaceId,
      this.toPublicDoc(doc),
      "delete",
      doc.createdBy || "",
    );
    await this.writeManifest(manifest);
    return true;
  }

  async recordView(workspaceId: string, docId: string): Promise<KnowledgeDoc | null> {
    const manifest = await this.readManifest();
    const doc = manifest.documents.find(
      (item) => item.workspaceId === workspaceId && item.id === docId && item.deletedAt === null,
    );
    if (!doc) return null;

    doc.metrics.views += 1;
    doc.metrics.lastViewedAt = nowIso();
    doc.updatedAt = nowIso();
    await writeJsonKey(this.liveDocKey(workspaceId, doc.id), this.toPublicDoc(doc));
    await this.writeManifest(manifest);
    return this.toPublicDoc(doc);
  }

  async addFeedback(
    workspaceId: string,
    docId: string,
    feedback: KnowledgeFeedback,
  ): Promise<KnowledgeDoc | null> {
    const manifest = await this.readManifest();
    const doc = manifest.documents.find(
      (item) => item.workspaceId === workspaceId && item.id === docId && item.deletedAt === null,
    );
    if (!doc) return null;

    doc.metrics.feedback.push(feedback);
    doc.updatedAt = nowIso();
    manifest.feedback.unshift({ ...feedback, workspaceId, docId });
    await writeJsonKey(this.liveDocKey(workspaceId, doc.id), this.toPublicDoc(doc));
    await this.writeManifest(manifest);
    return this.toPublicDoc(doc);
  }

  async listVersions(workspaceId: string, docId: string): Promise<KnowledgeDocVersion[]> {
    const manifest = await this.readManifest();
    return manifest.versions
      .filter((item) => item.workspaceId === workspaceId && item.docId === docId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(({ workspaceId: _workspaceId, snapshotKey: _snapshotKey, ...version }) => version);
  }

  async restoreVersion(workspaceId: string, docId: string, versionId: string): Promise<KnowledgeDoc | null> {
    const manifest = await this.readManifest();
    const version = manifest.versions.find(
      (item) => item.workspaceId === workspaceId && item.docId === docId && item.id === versionId,
    );
    if (!version) return null;

    const snapshot = await readJsonKey<KnowledgeDoc | null>(version.snapshotKey, null);
    if (!snapshot) return null;

    const index = manifest.documents.findIndex(
      (item) => item.workspaceId === workspaceId && item.id === docId,
    );
    if (index < 0) return null;

    const existing = manifest.documents[index];
    const restored: BrainDocumentRecord = {
      ...existing,
      ...snapshot,
      id: docId,
      workspaceId,
      deletedAt: null,
      updatedAt: nowIso(),
      metrics: existing.metrics,
    };

    manifest.documents[index] = restored;
    await writeJsonKey(this.liveDocKey(workspaceId, restored.id), this.toPublicDoc(restored));
    await this.createVersion(
      manifest,
      workspaceId,
      this.toPublicDoc(restored),
      "restore",
      restored.createdBy || "",
    );
    await this.writeManifest(manifest);
    return this.toPublicDoc(restored);
  }
}

let singleton: BrainStore | null = null;

export function getBrainStore(): BrainStore {
  singleton ??= new BrainStore();
  return singleton;
}

export function resetBrainStoreForTests(): void {
  singleton = null;
}

export async function requireWorkspace(token: string | null): Promise<string> {
  if (!token) {
    throw new Error("Missing Brain token");
  }

  const payload = decodeToken(getBrainConfig().tokenSecret, token);
  if (!payload?.workspaceId) {
    throw new Error("Invalid Brain token");
  }

  return payload.workspaceId;
}

export function getBrainTokenFromHeaders(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }
  return headers.get("x-brain-token");
}

export function createShareToken(workspaceId: string): string {
  const salt = createHash("sha256").update(workspaceId).digest("hex").slice(0, 8);
  return encodeToken(getBrainConfig().tokenSecret, {
    workspaceId,
    role: "writer",
    salt,
  });
}

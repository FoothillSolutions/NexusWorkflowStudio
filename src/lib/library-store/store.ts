import fs from "node:fs/promises";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { getLibraryConfig } from "./config";
import { FilesystemObjectStorage, OBJECT_KEYS, type ObjectStorage } from "./object-store";
import { computeContentHash } from "./hashing";
import { threeWayTextMerge } from "./merge";
import { buildManifest } from "./manifest";
import { parseSkillFrontmatter, validatePack } from "./validation";
import type {
  BranchRecord,
  ConflictRecord,
  CreateDocumentInput,
  CreatePackInput,
  CreateSkillInput,
  LibraryDocumentRecord,
  LibraryDocumentVersionRecord,
  LibraryManifest,
  LibraryRecord,
  MergeRecord,
  PackRecord,
  PackVersionDocumentRecord,
  PackVersionRecord,
  PublishPackVersionInput,
  PublishSkillVersionInput,
  ResolveLiveInput,
  SaveDocumentVersionInput,
  SkillBundle,
  SkillBundleDocument,
  SkillRecord,
  SkillVersionDocumentRecord,
  SkillVersionRecord,
  ValidationWarning,
} from "./types";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const MANIFEST_FILE = "manifest.json";

function nowIso(): string {
  return new Date().toISOString();
}

function createEmptyManifest(): LibraryManifest {
  return {
    version: 1,
    libraries: [],
    packs: [],
    skills: [],
    documents: [],
    versions: [],
    packVersions: [],
    packVersionDocuments: [],
    skillVersions: [],
    skillVersionDocuments: [],
    branches: [],
    merges: [],
    conflicts: [],
  };
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export class StaleVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleVersionError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly warnings: ValidationWarning[]) {
    super(message);
    this.name = "ValidationError";
  }
}

export class LibraryStore {
  private readonly dataDir = getLibraryConfig().dataDir;
  private readonly objects: ObjectStorage = new FilesystemObjectStorage(this.dataDir);

  getObjectStorage(): ObjectStorage {
    return this.objects;
  }

  private manifestPath(): string {
    return path.join(this.dataDir, MANIFEST_FILE);
  }

  async readManifest(): Promise<LibraryManifest> {
    await ensureDir(this.dataDir);
    return readJsonFile(this.manifestPath(), createEmptyManifest());
  }

  async writeManifest(manifest: LibraryManifest): Promise<void> {
    await writeJsonFile(this.manifestPath(), manifest);
  }

  // ── Library bootstrap ─────────────────────────────────────────────────

  async ensureLibraries(workspaceId: string, ownerUserId: string | null): Promise<{ workspace: LibraryRecord; user: LibraryRecord | null }> {
    const manifest = await this.readManifest();
    let workspace = manifest.libraries.find(
      (l) => l.workspaceId === workspaceId && l.scope === "workspace" && l.deletedAt === null,
    );
    let user = ownerUserId
      ? manifest.libraries.find(
          (l) => l.workspaceId === workspaceId && l.scope === "user" && l.ownerUserId === ownerUserId && l.deletedAt === null,
        )
      : null;

    let mutated = false;
    if (!workspace) {
      const now = nowIso();
      workspace = {
        id: nanoid(),
        workspaceId,
        scope: "workspace",
        ownerUserId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      manifest.libraries.push(workspace);
      mutated = true;
    }
    if (ownerUserId && !user) {
      const now = nowIso();
      user = {
        id: nanoid(),
        workspaceId,
        scope: "user",
        ownerUserId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      manifest.libraries.push(user);
      mutated = true;
    }

    if (mutated) await this.writeManifest(manifest);
    return { workspace: workspace!, user: user ?? null };
  }

  async listLibraries(workspaceId: string): Promise<LibraryRecord[]> {
    const manifest = await this.readManifest();
    return manifest.libraries.filter((l) => l.workspaceId === workspaceId && l.deletedAt === null);
  }

  // ── Pack CRUD ─────────────────────────────────────────────────────────

  async createPack(libraryId: string, input: CreatePackInput): Promise<PackRecord> {
    const manifest = await this.readManifest();
    const library = manifest.libraries.find((l) => l.id === libraryId);
    if (!library) throw new NotFoundError(`Library ${libraryId} not found`);

    const dup = manifest.packs.find(
      (p) => p.libraryId === libraryId && p.packKey === input.packKey && p.deletedAt === null,
    );
    if (dup) throw new Error(`Pack with key "${input.packKey}" already exists in library`);

    const now = nowIso();
    const branchId = nanoid();
    const pack: PackRecord = {
      id: nanoid(),
      libraryId,
      packKey: input.packKey,
      name: input.name,
      description: input.description ?? "",
      tags: input.tags ?? [],
      basePackId: null,
      external: false,
      currentBranchId: branchId,
      createdBy: input.createdBy ?? "",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      metadata: input.metadata,
    };
    const branch: BranchRecord = {
      id: branchId,
      packId: pack.id,
      name: "main",
      baseVersionByDocId: {},
      headVersionByDocId: {},
      createdAt: now,
      updatedAt: now,
    };
    manifest.packs.push(pack);
    manifest.branches.push(branch);
    await this.writeManifest(manifest);
    return pack;
  }

  async listPacks(libraryId: string, options?: { includeDeleted?: boolean }): Promise<PackRecord[]> {
    const manifest = await this.readManifest();
    return manifest.packs.filter(
      (p) => p.libraryId === libraryId && (options?.includeDeleted || p.deletedAt === null),
    );
  }

  async listAllPacks(workspaceId: string, options?: { includeDeleted?: boolean }): Promise<PackRecord[]> {
    const manifest = await this.readManifest();
    const libIds = new Set(
      manifest.libraries
        .filter((l) => l.workspaceId === workspaceId && l.deletedAt === null)
        .map((l) => l.id),
    );
    return manifest.packs.filter(
      (p) => libIds.has(p.libraryId) && (options?.includeDeleted || p.deletedAt === null),
    );
  }

  async getPack(packId: string): Promise<PackRecord | null> {
    const manifest = await this.readManifest();
    return manifest.packs.find((p) => p.id === packId) ?? null;
  }

  async renamePack(packId: string, input: { name?: string; description?: string; tags?: string[] }): Promise<PackRecord> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);
    if (input.name !== undefined) pack.name = input.name;
    if (input.description !== undefined) pack.description = input.description;
    if (input.tags !== undefined) pack.tags = input.tags;
    pack.updatedAt = nowIso();
    await this.writeManifest(manifest);
    return pack;
  }

  async movePack(packId: string, targetLibraryId: string): Promise<PackRecord> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);
    const targetLib = manifest.libraries.find((l) => l.id === targetLibraryId);
    if (!targetLib) throw new NotFoundError(`Library ${targetLibraryId} not found`);
    pack.libraryId = targetLibraryId;
    pack.updatedAt = nowIso();
    await this.writeManifest(manifest);
    return pack;
  }

  async softDeletePack(packId: string): Promise<void> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);
    pack.deletedAt = nowIso();
    pack.updatedAt = pack.deletedAt;
    await this.writeManifest(manifest);
  }

  async restorePack(packId: string): Promise<PackRecord> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);
    pack.deletedAt = null;
    pack.updatedAt = nowIso();
    await this.writeManifest(manifest);
    return pack;
  }

  async searchPacks(libraryId: string, query: string): Promise<PackRecord[]> {
    const manifest = await this.readManifest();
    const q = query.trim().toLowerCase();
    if (!q) return manifest.packs.filter((p) => p.libraryId === libraryId && p.deletedAt === null);
    return manifest.packs.filter((p) => {
      if (p.libraryId !== libraryId || p.deletedAt !== null) return false;
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.description.toLowerCase().includes(q)) return true;
      if (p.tags.some((t) => t.toLowerCase().includes(q))) return true;
      const skills = manifest.skills.filter((s) => s.packId === p.id && s.deletedAt === null);
      if (skills.some((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))) {
        return true;
      }
      return false;
    });
  }

  // ── Fork ──────────────────────────────────────────────────────────────

  async forkPack(sourcePackId: string, targetLibraryId: string, options?: { packKey?: string; createdBy?: string }): Promise<PackRecord> {
    const manifest = await this.readManifest();
    const source = manifest.packs.find((p) => p.id === sourcePackId);
    if (!source) throw new NotFoundError(`Source pack ${sourcePackId} not found`);

    const targetLib = manifest.libraries.find((l) => l.id === targetLibraryId);
    if (!targetLib) throw new NotFoundError(`Target library ${targetLibraryId} not found`);

    const desiredKey = options?.packKey ?? source.packKey;
    let key = desiredKey;
    let suffix = 1;
    while (manifest.packs.some((p) => p.libraryId === targetLibraryId && p.packKey === key && p.deletedAt === null)) {
      key = `${desiredKey}-fork-${suffix++}`;
    }

    const now = nowIso();
    const branchId = nanoid();
    const fork: PackRecord = {
      id: nanoid(),
      libraryId: targetLibraryId,
      packKey: key,
      name: source.name,
      description: source.description,
      tags: [...source.tags],
      basePackId: source.id,
      external: source.external,
      currentBranchId: branchId,
      createdBy: options?.createdBy ?? "",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      metadata: source.metadata ? { ...source.metadata } : undefined,
    };
    manifest.packs.push(fork);

    const sourceDocs = manifest.documents.filter((d) => d.packId === source.id && d.deletedAt === null);
    const docIdMap = new Map<string, string>();
    const headByDoc: Record<string, string> = {};
    const baseByDoc: Record<string, string> = {};

    for (const sourceDoc of sourceDocs) {
      const newDocId = nanoid();
      docIdMap.set(sourceDoc.id, newDocId);

      const sourceContent = await this.readDocumentContent(sourceDoc.id, sourceDoc.currentVersionId);
      const versionId = nanoid();
      const contentKey = OBJECT_KEYS.documentVersionContent(newDocId, versionId);
      const metadataKey = OBJECT_KEYS.documentVersionMetadata(newDocId, versionId);
      const contentHash = computeContentHash(sourceContent ?? "");
      const byteLength = Buffer.byteLength(sourceContent ?? "", "utf8");
      await this.objects.putObject(contentKey, sourceContent ?? "", { immutable: true });
      await this.objects.putObject(
        metadataKey,
        JSON.stringify({ contentHash, byteLength, createdAt: now, message: "fork" }, null, 2),
        { immutable: true },
      );

      const newDoc: LibraryDocumentRecord = {
        id: newDocId,
        packId: fork.id,
        role: sourceDoc.role,
        path: sourceDoc.path,
        currentVersionId: versionId,
        createdBy: options?.createdBy ?? "",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      manifest.documents.push(newDoc);
      const newVersion: LibraryDocumentVersionRecord = {
        id: versionId,
        docId: newDocId,
        packId: fork.id,
        parentVersionId: null,
        contentKey,
        contentHash,
        byteLength,
        message: "fork",
        createdBy: options?.createdBy ?? "",
        createdAt: now,
      };
      manifest.versions.push(newVersion);
      headByDoc[newDocId] = versionId;
      baseByDoc[newDocId] = sourceDoc.currentVersionId;
    }

    const branch: BranchRecord = {
      id: branchId,
      packId: fork.id,
      name: "main",
      baseVersionByDocId: baseByDoc,
      headVersionByDocId: headByDoc,
      createdAt: now,
      updatedAt: now,
    };
    manifest.branches.push(branch);

    const sourceSkills = manifest.skills.filter((s) => s.packId === source.id && s.deletedAt === null);
    for (const sourceSkill of sourceSkills) {
      const mappedDocId = docIdMap.get(sourceSkill.entrypointDocId);
      if (!mappedDocId) continue;
      const newSkill: SkillRecord = {
        id: nanoid(),
        packId: fork.id,
        skillKey: sourceSkill.skillKey,
        name: sourceSkill.name,
        description: sourceSkill.description,
        entrypointDocId: mappedDocId,
        createdBy: options?.createdBy ?? "",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deprecated: sourceSkill.deprecated,
        metadata: sourceSkill.metadata ? { ...sourceSkill.metadata } : undefined,
      };
      manifest.skills.push(newSkill);
    }

    await this.writeManifest(manifest);
    return fork;
  }

  // ── Documents ─────────────────────────────────────────────────────────

  async createDocument(packId: string, input: CreateDocumentInput): Promise<{ document: LibraryDocumentRecord; version: LibraryDocumentVersionRecord }> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);

    const branch = manifest.branches.find((b) => b.id === pack.currentBranchId);
    if (!branch) throw new Error(`Branch ${pack.currentBranchId} not found for pack ${packId}`);

    const now = nowIso();
    const docId = nanoid();
    const versionId = nanoid();
    const contentKey = OBJECT_KEYS.documentVersionContent(docId, versionId);
    const metadataKey = OBJECT_KEYS.documentVersionMetadata(docId, versionId);
    const contentHash = computeContentHash(input.content);
    const byteLength = Buffer.byteLength(input.content, "utf8");

    await this.objects.putObject(contentKey, input.content, { immutable: true });
    await this.objects.putObject(
      metadataKey,
      JSON.stringify({ contentHash, byteLength, createdAt: now, message: input.message ?? "create" }, null, 2),
      { immutable: true },
    );

    const document: LibraryDocumentRecord = {
      id: docId,
      packId,
      role: input.role,
      path: input.path,
      currentVersionId: versionId,
      createdBy: input.createdBy ?? "",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      metadata: input.metadata,
    };
    const version: LibraryDocumentVersionRecord = {
      id: versionId,
      docId,
      packId,
      parentVersionId: null,
      contentKey,
      contentHash,
      byteLength,
      message: input.message ?? "create",
      createdBy: input.createdBy ?? "",
      createdAt: now,
      metadata: input.metadata,
    };
    manifest.documents.push(document);
    manifest.versions.push(version);
    branch.headVersionByDocId[docId] = versionId;
    branch.updatedAt = now;
    pack.updatedAt = now;
    await this.writeManifest(manifest);
    return { document, version };
  }

  async listDocuments(packId: string, options?: { includeDeleted?: boolean }): Promise<LibraryDocumentRecord[]> {
    const manifest = await this.readManifest();
    return manifest.documents.filter(
      (d) => d.packId === packId && (options?.includeDeleted || d.deletedAt === null),
    );
  }

  async listVersions(docId: string): Promise<LibraryDocumentVersionRecord[]> {
    const manifest = await this.readManifest();
    return manifest.versions
      .filter((v) => v.docId === docId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async readDocumentContent(docId: string, versionId: string): Promise<string | null> {
    const manifest = await this.readManifest();
    const version = manifest.versions.find((v) => v.id === versionId && v.docId === docId);
    if (!version) return null;
    return this.objects.getObjectAsString(version.contentKey);
  }

  async saveDocumentVersion(docId: string, input: SaveDocumentVersionInput): Promise<LibraryDocumentVersionRecord> {
    const manifest = await this.readManifest();
    const document = manifest.documents.find((d) => d.id === docId);
    if (!document) throw new NotFoundError(`Document ${docId} not found`);
    if (document.currentVersionId !== input.previousVersionId) {
      throw new StaleVersionError(
        `Stale previousVersionId. Expected ${document.currentVersionId}, got ${input.previousVersionId}`,
      );
    }

    const now = nowIso();
    const versionId = nanoid();
    const contentKey = OBJECT_KEYS.documentVersionContent(docId, versionId);
    const metadataKey = OBJECT_KEYS.documentVersionMetadata(docId, versionId);
    const contentHash = computeContentHash(input.content);
    const byteLength = Buffer.byteLength(input.content, "utf8");

    await this.objects.putObject(contentKey, input.content, { immutable: true });
    await this.objects.putObject(
      metadataKey,
      JSON.stringify({ contentHash, byteLength, createdAt: now, message: input.message ?? "save" }, null, 2),
      { immutable: true },
    );

    const version: LibraryDocumentVersionRecord = {
      id: versionId,
      docId,
      packId: document.packId,
      parentVersionId: document.currentVersionId,
      contentKey,
      contentHash,
      byteLength,
      message: input.message ?? "save",
      createdBy: input.createdBy ?? "",
      createdAt: now,
      metadata: input.metadata,
    };

    document.currentVersionId = versionId;
    document.updatedAt = now;
    manifest.versions.push(version);

    const pack = manifest.packs.find((p) => p.id === document.packId);
    if (pack) {
      const branch = manifest.branches.find((b) => b.id === pack.currentBranchId);
      if (branch) {
        branch.headVersionByDocId[docId] = versionId;
        branch.updatedAt = now;
      }
      pack.updatedAt = now;
    }

    await this.writeManifest(manifest);
    return version;
  }

  async renameDocument(docId: string, newPath: string): Promise<LibraryDocumentRecord> {
    const manifest = await this.readManifest();
    const document = manifest.documents.find((d) => d.id === docId);
    if (!document) throw new NotFoundError(`Document ${docId} not found`);
    document.path = newPath;
    document.updatedAt = nowIso();
    await this.writeManifest(manifest);
    return document;
  }

  async moveDocument(docId: string, newPath: string): Promise<LibraryDocumentRecord> {
    return this.renameDocument(docId, newPath);
  }

  async softDeleteDocument(docId: string): Promise<void> {
    const manifest = await this.readManifest();
    const document = manifest.documents.find((d) => d.id === docId);
    if (!document) throw new NotFoundError(`Document ${docId} not found`);
    document.deletedAt = nowIso();
    document.updatedAt = document.deletedAt;
    await this.writeManifest(manifest);
  }

  async restoreDocument(docId: string): Promise<LibraryDocumentRecord> {
    const manifest = await this.readManifest();
    const document = manifest.documents.find((d) => d.id === docId);
    if (!document) throw new NotFoundError(`Document ${docId} not found`);
    document.deletedAt = null;
    document.updatedAt = nowIso();
    await this.writeManifest(manifest);
    return document;
  }

  // ── Skills ────────────────────────────────────────────────────────────

  async createSkill(packId: string, input: CreateSkillInput): Promise<SkillRecord> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);

    const dup = manifest.skills.find(
      (s) => s.packId === packId && s.skillKey === input.skillKey && s.deletedAt === null,
    );
    if (dup) throw new Error(`Skill key "${input.skillKey}" already exists in pack`);

    const document = manifest.documents.find((d) => d.id === input.entrypointDocId);
    if (!document) throw new NotFoundError(`Entrypoint document ${input.entrypointDocId} not found`);

    const now = nowIso();
    const skill: SkillRecord = {
      id: nanoid(),
      packId,
      skillKey: input.skillKey,
      name: input.name,
      description: input.description,
      entrypointDocId: input.entrypointDocId,
      createdBy: input.createdBy ?? "",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deprecated: false,
      metadata: input.metadata,
    };
    manifest.skills.push(skill);
    pack.updatedAt = now;
    await this.writeManifest(manifest);
    return skill;
  }

  async listSkills(packId: string): Promise<SkillRecord[]> {
    const manifest = await this.readManifest();
    return manifest.skills.filter((s) => s.packId === packId && s.deletedAt === null);
  }

  async updateSkill(skillId: string, patch: Partial<Pick<SkillRecord, "name" | "description" | "entrypointDocId" | "deprecated">>): Promise<SkillRecord> {
    const manifest = await this.readManifest();
    const skill = manifest.skills.find((s) => s.id === skillId);
    if (!skill) throw new NotFoundError(`Skill ${skillId} not found`);
    Object.assign(skill, patch);
    skill.updatedAt = nowIso();
    await this.writeManifest(manifest);
    return skill;
  }

  async softDeleteSkill(skillId: string): Promise<void> {
    const manifest = await this.readManifest();
    const skill = manifest.skills.find((s) => s.id === skillId);
    if (!skill) throw new NotFoundError(`Skill ${skillId} not found`);
    skill.deletedAt = nowIso();
    skill.updatedAt = skill.deletedAt;
    await this.writeManifest(manifest);
  }

  // ── Validation helper ────────────────────────────────────────────────

  async validatePackById(packId: string): Promise<ValidationWarning[]> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);
    const skills = manifest.skills.filter((s) => s.packId === packId);
    const documents = manifest.documents.filter((d) => d.packId === packId);
    const documentContents = new Map<string, string>();
    for (const d of documents.filter((doc) => doc.deletedAt === null)) {
      const content = await this.readDocumentContent(d.id, d.currentVersionId);
      documentContents.set(d.id, content ?? "");
    }
    const unresolved = manifest.merges
      .filter((m) => m.packId === packId && m.status === "conflict")
      .map((m) => m.id);
    return validatePack({ pack, skills, documents, documentContents, unresolvedMergeIds: unresolved });
  }

  // ── Publish ───────────────────────────────────────────────────────────

  async publishPackVersion(packId: string, input: PublishPackVersionInput): Promise<PackVersionRecord> {
    const warnings = await this.validatePackById(packId);
    const errors = warnings.filter((w) => w.level === "error");
    if (errors.length > 0) {
      throw new ValidationError(`Pack has ${errors.length} validation error(s)`, errors);
    }

    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);
    const library = manifest.libraries.find((l) => l.id === pack.libraryId);
    if (!library) throw new NotFoundError(`Library ${pack.libraryId} not found`);
    const dup = manifest.packVersions.find((pv) => pv.packId === packId && pv.version === input.version);
    if (dup) throw new Error(`Pack version ${input.version} already exists`);

    const skills = manifest.skills.filter((s) => s.packId === packId && s.deletedAt === null);
    const documents = manifest.documents.filter((d) => d.packId === packId && d.deletedAt === null);

    const now = nowIso();
    const versionId = nanoid();
    const manifestObj = buildManifest({ pack, skills, documents, scope: library.scope, version: input.version });
    const manifestJson = JSON.stringify(manifestObj, null, 2);
    const manifestKey = OBJECT_KEYS.packVersionManifest(packId, versionId);
    const manifestHash = computeContentHash(manifestJson);
    await this.objects.putObject(manifestKey, manifestJson, { immutable: true });

    const packVersion: PackVersionRecord = {
      id: versionId,
      packId,
      version: input.version,
      manifestKey,
      manifestHash,
      createdBy: input.createdBy ?? "",
      createdAt: now,
      deprecated: false,
      deletedAt: null,
      notes: input.notes ?? "",
    };
    manifest.packVersions.push(packVersion);

    for (const doc of documents) {
      const record: PackVersionDocumentRecord = {
        id: nanoid(),
        packVersionId: versionId,
        packId,
        docId: doc.id,
        versionId: doc.currentVersionId,
        role: doc.role,
        path: doc.path,
        contentHash: manifest.versions.find((v) => v.id === doc.currentVersionId)?.contentHash ?? "",
      };
      manifest.packVersionDocuments.push(record);
    }

    pack.updatedAt = now;
    await this.writeManifest(manifest);
    return packVersion;
  }

  async listPackVersions(packId: string): Promise<PackVersionRecord[]> {
    const manifest = await this.readManifest();
    return manifest.packVersions
      .filter((pv) => pv.packId === packId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async deprecatePackVersion(packVersionId: string, deprecated: boolean): Promise<PackVersionRecord> {
    const manifest = await this.readManifest();
    const pv = manifest.packVersions.find((p) => p.id === packVersionId);
    if (!pv) throw new NotFoundError(`Pack version ${packVersionId} not found`);
    pv.deprecated = deprecated;
    await this.writeManifest(manifest);
    return pv;
  }

  async publishSkillVersion(skillId: string, input: PublishSkillVersionInput): Promise<SkillVersionRecord> {
    const manifest = await this.readManifest();
    const skill = manifest.skills.find((s) => s.id === skillId);
    if (!skill) throw new NotFoundError(`Skill ${skillId} not found`);
    const dup = manifest.skillVersions.find((sv) => sv.skillId === skillId && sv.version === input.version);
    if (dup) throw new Error(`Skill version ${input.version} already exists`);

    const now = nowIso();
    const versionId = nanoid();
    let packVersionId: string | null = null;
    if (input.linkToLatestPackVersion) {
      const latest = manifest.packVersions
        .filter((pv) => pv.packId === skill.packId && pv.deletedAt === null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      packVersionId = latest?.id ?? null;
    }

    const skillVersion: SkillVersionRecord = {
      id: versionId,
      skillId,
      packId: skill.packId,
      version: input.version,
      packVersionId,
      createdBy: input.createdBy ?? "",
      createdAt: now,
      deprecated: false,
      deletedAt: null,
      notes: input.notes ?? "",
    };
    manifest.skillVersions.push(skillVersion);

    const entrypoint = manifest.documents.find((d) => d.id === skill.entrypointDocId);
    if (entrypoint) {
      const docRecord: SkillVersionDocumentRecord = {
        id: nanoid(),
        skillVersionId: versionId,
        skillId,
        docId: entrypoint.id,
        versionId: entrypoint.currentVersionId,
        contentHash: manifest.versions.find((v) => v.id === entrypoint.currentVersionId)?.contentHash ?? "",
      };
      manifest.skillVersionDocuments.push(docRecord);
    }
    const refs = manifest.documents.filter(
      (d) => d.packId === skill.packId && d.role === "reference" && d.deletedAt === null,
    );
    for (const r of refs) {
      manifest.skillVersionDocuments.push({
        id: nanoid(),
        skillVersionId: versionId,
        skillId,
        docId: r.id,
        versionId: r.currentVersionId,
        contentHash: manifest.versions.find((v) => v.id === r.currentVersionId)?.contentHash ?? "",
      });
    }

    skill.updatedAt = now;
    await this.writeManifest(manifest);
    return skillVersion;
  }

  async listSkillVersions(skillId: string): Promise<SkillVersionRecord[]> {
    const manifest = await this.readManifest();
    return manifest.skillVersions
      .filter((sv) => sv.skillId === skillId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ── Resolve ──────────────────────────────────────────────────────────

  async resolveLive(input: ResolveLiveInput): Promise<SkillBundle | null> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === input.packId);
    if (!pack) return null;
    const library = manifest.libraries.find((l) => l.id === pack.libraryId);
    if (!library || library.scope !== input.scope) return null;
    const skill = manifest.skills.find((s) => s.id === input.skillId && s.packId === pack.id);
    if (!skill) return null;

    if (input.packVersion === "draft") {
      const entrypoint = manifest.documents.find((d) => d.id === skill.entrypointDocId);
      if (!entrypoint) return null;
      const refs = manifest.documents.filter(
        (d) => d.packId === pack.id && d.role === "reference" && d.deletedAt === null,
      );
      const entrypointContent = (await this.readDocumentContent(entrypoint.id, entrypoint.currentVersionId)) ?? "";
      const entryDoc: SkillBundleDocument = {
        docId: entrypoint.id,
        path: entrypoint.path,
        role: entrypoint.role,
        content: entrypointContent,
        contentHash: computeContentHash(entrypointContent),
      };
      const refDocs: SkillBundleDocument[] = [];
      for (const r of refs) {
        const c = (await this.readDocumentContent(r.id, r.currentVersionId)) ?? "";
        refDocs.push({
          docId: r.id,
          path: r.path,
          role: r.role,
          content: c,
          contentHash: computeContentHash(c),
        });
      }
      return {
        scope: library.scope,
        packId: pack.id,
        packKey: pack.packKey,
        packVersion: "draft",
        skillId: skill.id,
        skillKey: skill.skillKey,
        skillName: skill.name,
        description: skill.description,
        entrypoint: entryDoc,
        documents: refDocs,
        manifestHash: "",
      };
    }

    const packVersion = manifest.packVersions.find(
      (pv) => pv.packId === pack.id && pv.version === input.packVersion,
    );
    if (!packVersion) return null;
    const versionDocs = manifest.packVersionDocuments.filter((pvd) => pvd.packVersionId === packVersion.id);
    const entryRef = versionDocs.find((vd) => vd.docId === skill.entrypointDocId);
    if (!entryRef) return null;
    const entryContent = (await this.readDocumentContent(entryRef.docId, entryRef.versionId)) ?? "";
    const entryDoc: SkillBundleDocument = {
      docId: entryRef.docId,
      path: entryRef.path,
      role: entryRef.role,
      content: entryContent,
      contentHash: entryRef.contentHash || computeContentHash(entryContent),
    };
    const refDocs: SkillBundleDocument[] = [];
    for (const vd of versionDocs.filter((d) => d.role === "reference" && d.docId !== entryRef.docId)) {
      const c = (await this.readDocumentContent(vd.docId, vd.versionId)) ?? "";
      refDocs.push({
        docId: vd.docId,
        path: vd.path,
        role: vd.role,
        content: c,
        contentHash: vd.contentHash || computeContentHash(c),
      });
    }
    return {
      scope: library.scope,
      packId: pack.id,
      packKey: pack.packKey,
      packVersion: packVersion.version,
      skillId: skill.id,
      skillKey: skill.skillKey,
      skillName: skill.name,
      description: skill.description,
      entrypoint: entryDoc,
      documents: refDocs,
      manifestHash: packVersion.manifestHash,
    };
  }

  // ── Branch / merge ───────────────────────────────────────────────────

  async getForkState(packId: string): Promise<{ behind: boolean; conflict: boolean; basePackId: string | null }> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack || !pack.basePackId) return { behind: false, conflict: false, basePackId: null };
    const branch = manifest.branches.find((b) => b.id === pack.currentBranchId);
    if (!branch) return { behind: false, conflict: false, basePackId: pack.basePackId };
    const baseDocs = manifest.documents.filter((d) => d.packId === pack.basePackId && d.deletedAt === null);

    const conflict = manifest.merges.some(
      (m) => m.packId === packId && m.status === "conflict",
    );
    let behind = false;
    for (const baseDoc of baseDocs) {
      const ourDoc = manifest.documents.find((d) => d.packId === packId && d.path === baseDoc.path && d.deletedAt === null);
      if (!ourDoc) {
        behind = true;
        break;
      }
      const baseFromBranch = branch.baseVersionByDocId[ourDoc.id];
      if (baseFromBranch && baseFromBranch !== baseDoc.currentVersionId) {
        behind = true;
        break;
      }
    }
    return { behind, conflict, basePackId: pack.basePackId };
  }

  async mergeBaseIntoBranch(packId: string, options?: { initiatedBy?: string }): Promise<MergeRecord> {
    const manifest = await this.readManifest();
    const pack = manifest.packs.find((p) => p.id === packId);
    if (!pack) throw new NotFoundError(`Pack ${packId} not found`);
    if (!pack.basePackId) throw new Error("Pack is not a fork");
    const branch = manifest.branches.find((b) => b.id === pack.currentBranchId);
    if (!branch) throw new Error(`Branch ${pack.currentBranchId} not found`);

    const now = nowIso();
    const mergeId = nanoid();
    const cleanlyMerged: string[] = [];
    const conflictDocs: string[] = [];
    const conflictRecords: ConflictRecord[] = [];

    const baseDocs = manifest.documents.filter(
      (d) => d.packId === pack.basePackId && d.deletedAt === null,
    );

    for (const baseDoc of baseDocs) {
      const ourDoc = manifest.documents.find(
        (d) => d.packId === packId && d.path === baseDoc.path && d.deletedAt === null,
      );
      if (!ourDoc) continue;
      const ancestorVersionId = branch.baseVersionByDocId[ourDoc.id];
      if (ancestorVersionId === baseDoc.currentVersionId) {
        cleanlyMerged.push(ourDoc.id);
        continue;
      }
      const ancestor = ancestorVersionId
        ? (await this.readDocumentContent(ourDoc.id, ancestorVersionId))
          ?? (await this.readDocumentContent(baseDoc.id, ancestorVersionId))
          ?? ""
        : "";
      const theirs = (await this.readDocumentContent(baseDoc.id, baseDoc.currentVersionId)) ?? "";
      const yours = (await this.readDocumentContent(ourDoc.id, ourDoc.currentVersionId)) ?? "";

      const merged = threeWayTextMerge(ancestor, theirs, yours);
      if (merged.cleanlyMerged) {
        const versionId = nanoid();
        const contentKey = OBJECT_KEYS.documentVersionContent(ourDoc.id, versionId);
        const metadataKey = OBJECT_KEYS.documentVersionMetadata(ourDoc.id, versionId);
        const contentHash = computeContentHash(merged.content);
        const byteLength = Buffer.byteLength(merged.content, "utf8");
        await this.objects.putObject(contentKey, merged.content, { immutable: true });
        await this.objects.putObject(
          metadataKey,
          JSON.stringify({ contentHash, byteLength, createdAt: now, message: "merge-base" }, null, 2),
          { immutable: true },
        );
        const newVersion: LibraryDocumentVersionRecord = {
          id: versionId,
          docId: ourDoc.id,
          packId,
          parentVersionId: ourDoc.currentVersionId,
          contentKey,
          contentHash,
          byteLength,
          message: "merge-base",
          createdBy: options?.initiatedBy ?? "",
          createdAt: now,
        };
        manifest.versions.push(newVersion);
        ourDoc.currentVersionId = versionId;
        ourDoc.updatedAt = now;
        branch.headVersionByDocId[ourDoc.id] = versionId;
        branch.baseVersionByDocId[ourDoc.id] = baseDoc.currentVersionId;
        cleanlyMerged.push(ourDoc.id);
      } else {
        conflictDocs.push(ourDoc.id);
        for (const conflict of merged.conflicts) {
          conflictRecords.push({
            id: nanoid(),
            mergeId,
            packId,
            docId: ourDoc.id,
            conflictType: conflict.conflictType,
            ancestorContent: conflict.ancestor,
            baseContent: conflict.base,
            branchContent: conflict.branch,
            resolved: false,
            resolvedAt: null,
            resolvedBy: null,
            resolutionContent: null,
          });
        }
      }
    }

    const status: MergeRecord["status"] = conflictDocs.length === 0 ? "clean" : "conflict";
    const merge: MergeRecord = {
      id: mergeId,
      packId,
      branchId: branch.id,
      basePackVersionId: null,
      initiatedBy: options?.initiatedBy ?? "",
      initiatedAt: now,
      status,
      mergedCleanlyDocs: cleanlyMerged,
      conflictDocs,
      completedAt: status === "clean" ? now : null,
    };
    manifest.merges.push(merge);
    manifest.conflicts.push(...conflictRecords);
    branch.updatedAt = now;
    pack.updatedAt = now;
    await this.writeManifest(manifest);
    return merge;
  }

  async listConflicts(mergeId: string): Promise<ConflictRecord[]> {
    const manifest = await this.readManifest();
    return manifest.conflicts.filter((c) => c.mergeId === mergeId);
  }

  async resolveMergeConflict(
    mergeId: string,
    input: { resolvedContentByDocId: Record<string, string>; resolvedBy?: string },
  ): Promise<MergeRecord> {
    const manifest = await this.readManifest();
    const merge = manifest.merges.find((m) => m.id === mergeId);
    if (!merge) throw new NotFoundError(`Merge ${mergeId} not found`);
    const branch = manifest.branches.find((b) => b.id === merge.branchId);
    if (!branch) throw new Error(`Branch ${merge.branchId} not found`);
    const pack = manifest.packs.find((p) => p.id === merge.packId);
    if (!pack || !pack.basePackId) throw new Error(`Pack ${merge.packId} is not a fork`);

    const now = nowIso();
    for (const [docId, content] of Object.entries(input.resolvedContentByDocId)) {
      const ourDoc = manifest.documents.find((d) => d.id === docId);
      if (!ourDoc) continue;
      const versionId = nanoid();
      const contentKey = OBJECT_KEYS.documentVersionContent(docId, versionId);
      const metadataKey = OBJECT_KEYS.documentVersionMetadata(docId, versionId);
      const contentHash = computeContentHash(content);
      const byteLength = Buffer.byteLength(content, "utf8");
      await this.objects.putObject(contentKey, content, { immutable: true });
      await this.objects.putObject(
        metadataKey,
        JSON.stringify({ contentHash, byteLength, createdAt: now, message: "resolve-conflict" }, null, 2),
        { immutable: true },
      );
      const newVersion: LibraryDocumentVersionRecord = {
        id: versionId,
        docId,
        packId: merge.packId,
        parentVersionId: ourDoc.currentVersionId,
        contentKey,
        contentHash,
        byteLength,
        message: "resolve-conflict",
        createdBy: input.resolvedBy ?? "",
        createdAt: now,
      };
      manifest.versions.push(newVersion);
      ourDoc.currentVersionId = versionId;
      ourDoc.updatedAt = now;
      branch.headVersionByDocId[docId] = versionId;
      const baseDoc = manifest.documents.find(
        (d) => d.packId === pack.basePackId && d.path === ourDoc.path && d.deletedAt === null,
      );
      if (baseDoc) {
        branch.baseVersionByDocId[docId] = baseDoc.currentVersionId;
      }

      for (const conflict of manifest.conflicts.filter((c) => c.mergeId === mergeId && c.docId === docId)) {
        conflict.resolved = true;
        conflict.resolvedAt = now;
        conflict.resolvedBy = input.resolvedBy ?? "";
        conflict.resolutionContent = content;
      }
    }

    const stillUnresolved = manifest.conflicts.some((c) => c.mergeId === mergeId && !c.resolved);
    if (!stillUnresolved) {
      merge.status = "resolved";
      merge.completedAt = now;
    }
    branch.updatedAt = now;
    pack.updatedAt = now;
    await this.writeManifest(manifest);
    return merge;
  }

  // ── Compare drafts to published ──────────────────────────────────────

  async compareDraftToPublished(packId: string, packVersionId: string): Promise<{ docId: string; status: "added" | "modified" | "removed" | "unchanged" }[]> {
    const manifest = await this.readManifest();
    const pv = manifest.packVersions.find((p) => p.id === packVersionId && p.packId === packId);
    if (!pv) throw new NotFoundError(`Pack version ${packVersionId} not found`);
    const pvDocs = manifest.packVersionDocuments.filter((d) => d.packVersionId === packVersionId);
    const pvByDocId = new Map(pvDocs.map((d) => [d.docId, d]));
    const currentDocs = manifest.documents.filter((d) => d.packId === packId);
    const result: { docId: string; status: "added" | "modified" | "removed" | "unchanged" }[] = [];
    for (const doc of currentDocs) {
      const pvDoc = pvByDocId.get(doc.id);
      if (doc.deletedAt !== null && pvDoc) {
        result.push({ docId: doc.id, status: "removed" });
      } else if (!pvDoc && doc.deletedAt === null) {
        result.push({ docId: doc.id, status: "added" });
      } else if (pvDoc && pvDoc.versionId !== doc.currentVersionId) {
        result.push({ docId: doc.id, status: "modified" });
      } else if (pvDoc) {
        result.push({ docId: doc.id, status: "unchanged" });
      }
    }
    return result;
  }
}

let singleton: LibraryStore | null = null;

export function getLibraryStore(): LibraryStore {
  singleton ??= new LibraryStore();
  return singleton;
}

export function resetLibraryStoreForTests(): void {
  singleton = null;
}

export { parseSkillFrontmatter };

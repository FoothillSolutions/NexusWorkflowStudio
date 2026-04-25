import fs from "node:fs/promises";
import path from "node:path";

export interface ObjectStorage {
  putObject(key: string, value: Buffer | string, options?: { contentType?: string; immutable?: boolean }): Promise<void>;
  getObject(key: string): Promise<Buffer | null>;
  getObjectAsString(key: string): Promise<string | null>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  listKeys(prefix: string): Promise<string[]>;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, content: Buffer | string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(tempPath, content);
  await fs.rename(tempPath, filePath);
}

function isImmutableKey(key: string): boolean {
  return /\/versions\//.test(key) || key.startsWith("exports/");
}

export class FilesystemObjectStorage implements ObjectStorage {
  constructor(private readonly dataDir: string) {}

  private resolveKey(key: string): string {
    const normalized = key.replace(/^\/+/, "");
    if (normalized.includes("..")) {
      throw new Error(`Invalid object key: ${key}`);
    }
    return path.join(this.dataDir, "objects", normalized);
  }

  async putObject(key: string, value: Buffer | string, options?: { immutable?: boolean }): Promise<void> {
    const filePath = this.resolveKey(key);
    const immutable = options?.immutable ?? isImmutableKey(key);

    if (immutable) {
      try {
        await fs.access(filePath);
        return;
      } catch {
      }
    }

    await atomicWrite(filePath, value);
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolveKey(key));
    } catch {
      return null;
    }
  }

  async getObjectAsString(key: string): Promise<string | null> {
    try {
      return await fs.readFile(this.resolveKey(key), "utf8");
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolveKey(key));
    } catch {
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async listKeys(prefix: string): Promise<string[]> {
    const root = this.resolveKey(prefix);
    const result: string[] = [];

    async function walk(dir: string, base: string): Promise<void> {
      let entries: { name: string; isDirectory: () => boolean }[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const name = entry.name as string;
        const full = path.join(dir, name);
        const rel = path.posix.join(base, name);
        if (entry.isDirectory()) {
          await walk(full, rel);
        } else {
          result.push(rel);
        }
      }
    }

    await walk(root, prefix.replace(/^\/+/, ""));
    return result;
  }
}

export interface ObjectKeys {
  documentVersionContent(docId: string, versionId: string): string;
  documentVersionMetadata(docId: string, versionId: string): string;
  packVersionManifest(packId: string, versionId: string): string;
  exportArchive(exportId: string): string;
}

export const OBJECT_KEYS: ObjectKeys = {
  documentVersionContent: (docId, versionId) => `documents/${docId}/versions/${versionId}/content.md`,
  documentVersionMetadata: (docId, versionId) => `documents/${docId}/versions/${versionId}/metadata.json`,
  packVersionManifest: (packId, versionId) => `packs/${packId}/versions/${versionId}/manifest.json`,
  exportArchive: (exportId) => `exports/${exportId}/workflow-export.nexus`,
};

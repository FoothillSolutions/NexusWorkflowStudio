import fs from "node:fs/promises";
import path from "node:path";
import type { StorageMetadata, StorageProvider } from "./types";

export class LocalFilesystemProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    const resolved = path.resolve(this.rootDir, key);
    const relative = path.relative(this.rootDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    // Empty relative means root directory itself — valid for list operations
    return resolved;
  }

  private async ensureParent(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  async read(key: string): Promise<string | null> {
    const filePath = this.resolve(key);
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      return null;
    }
  }

  async readBytes(key: string): Promise<Uint8Array | null> {
    const filePath = this.resolve(key);
    try {
      const buf = await fs.readFile(filePath);
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  }

  async write(key: string, content: string): Promise<void> {
    const filePath = this.resolve(key);
    await this.ensureParent(filePath);
    await fs.writeFile(filePath, content, "utf8");
  }

  async writeBytes(key: string, content: Uint8Array): Promise<void> {
    const filePath = this.resolve(key);
    await this.ensureParent(filePath);
    await fs.writeFile(filePath, content);
  }

  async writeAtomic(key: string, content: string | Uint8Array): Promise<void> {
    const filePath = this.resolve(key);
    const tmpPath = `${filePath}.tmp`;
    await this.ensureParent(filePath);
    if (typeof content === "string") {
      await fs.writeFile(tmpPath, content, "utf8");
    } else {
      await fs.writeFile(tmpPath, content);
    }
    await fs.rename(tmpPath, filePath);
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.resolve(key);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteTree(key: string): Promise<boolean> {
    const resolved = this.resolve(key);
    try {
      await fs.access(resolved);
      await fs.rm(resolved, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolve(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async stat(key: string): Promise<StorageMetadata | null> {
    const filePath = this.resolve(key);
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const resolved = this.resolve(prefix);
    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return entries.filter((e) => e.isFile()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  async listDirectories(prefix: string): Promise<string[]> {
    const resolved = this.resolve(prefix);
    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }
}

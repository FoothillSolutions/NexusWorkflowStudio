import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

interface CollabObjectMetadata {
  roomId: string;
  stateKey: string;
  updatedAt: string;
  byteLength: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, content: string | Uint8Array): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(tempPath, content);
  await fs.rename(tempPath, filePath);
}

export class CollabObjectStore {
  constructor(private readonly dataDir: string) {}

  private roomKey(roomId: string): string {
    return createHash("sha256").update(roomId).digest("hex");
  }

  private roomDir(roomId: string): string {
    return path.join(this.dataDir, "rooms", this.roomKey(roomId));
  }

  private statePath(roomId: string): string {
    return path.join(this.roomDir(roomId), "state.bin");
  }

  private metadataPath(roomId: string): string {
    return path.join(this.roomDir(roomId), "metadata.json");
  }

  async load(roomId: string): Promise<Uint8Array | null> {
    try {
      const state = await fs.readFile(this.statePath(roomId));
      return new Uint8Array(state);
    } catch {
      return null;
    }
  }

  async store(roomId: string, state: Uint8Array): Promise<void> {
    const stateKey = this.statePath(roomId);
    const metadata: CollabObjectMetadata = {
      roomId,
      stateKey,
      updatedAt: nowIso(),
      byteLength: state.byteLength,
    };

    await atomicWrite(stateKey, state);
    await atomicWrite(this.metadataPath(roomId), JSON.stringify(metadata, null, 2));
  }
}

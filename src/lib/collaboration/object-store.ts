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

  /**
   * Delete rooms that haven't been modified within `maxAgeMs`. Active rooms
   * write their Y.Doc to disk on every debounced change, so `updatedAt` is a
   * reliable liveness signal — anything older than the TTL is idle.
   *
   * Returns counts for logging. Swallows individual-room errors so one bad
   * directory can't halt the sweep.
   */
  async pruneOlderThan(maxAgeMs: number): Promise<{ pruned: number; kept: number }> {
    if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
      return { pruned: 0, kept: 0 };
    }

    const roomsRoot = path.join(this.dataDir, "rooms");
    let entries: string[];
    try {
      entries = await fs.readdir(roomsRoot);
    } catch {
      // No rooms dir yet → nothing to prune.
      return { pruned: 0, kept: 0 };
    }

    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;
    let kept = 0;

    for (const entry of entries) {
      const roomPath = path.join(roomsRoot, entry);
      const metaPath = path.join(roomPath, "metadata.json");

      try {
        const raw = await fs.readFile(metaPath, "utf8");
        const meta = JSON.parse(raw) as CollabObjectMetadata;
        const updatedAt = Date.parse(meta.updatedAt);

        if (!Number.isFinite(updatedAt)) {
          kept++;
          continue;
        }

        if (updatedAt < cutoff) {
          await fs.rm(roomPath, { recursive: true, force: true });
          pruned++;
        } else {
          kept++;
        }
      } catch {
        // Missing or malformed metadata → leave the directory alone so we
        // never delete a room we can't verify is idle.
        kept++;
      }
    }

    return { pruned, kept };
  }
}

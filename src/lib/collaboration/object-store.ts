import { createHash } from "node:crypto";
import type { StorageProvider } from "@/lib/storage";

interface CollabObjectMetadata {
  roomId: string;
  stateKey: string;
  updatedAt: string;
  byteLength: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class CollabObjectStore {
  constructor(private readonly provider: StorageProvider) {}

  private roomKey(roomId: string): string {
    return createHash("sha256").update(roomId).digest("hex");
  }

  private stateKey(roomId: string): string {
    return `rooms/${this.roomKey(roomId)}/state.bin`;
  }

  private metadataKey(roomId: string): string {
    return `rooms/${this.roomKey(roomId)}/metadata.json`;
  }

  async load(roomId: string): Promise<Uint8Array | null> {
    return this.provider.readBytes(this.stateKey(roomId));
  }

  async store(roomId: string, state: Uint8Array): Promise<void> {
    const key = this.stateKey(roomId);
    const metadata: CollabObjectMetadata = {
      roomId,
      stateKey: key,
      updatedAt: nowIso(),
      byteLength: state.byteLength,
    };

    await this.provider.writeAtomic(key, state);
    await this.provider.writeAtomic(
      this.metadataKey(roomId),
      JSON.stringify(metadata, null, 2),
    );
  }
}

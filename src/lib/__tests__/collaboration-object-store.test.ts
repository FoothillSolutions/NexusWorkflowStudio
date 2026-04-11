import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { CollabObjectStore } from "../collaboration/object-store";
import { LocalFilesystemProvider } from "../storage/local-provider";

let tempDir = "";

describe("CollabObjectStore", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-collab-test-"));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("stores and reloads room state with metadata", async () => {
    const provider = new LocalFilesystemProvider(tempDir);
    const store = new CollabObjectStore(provider);
    const state = new Uint8Array([1, 2, 3, 4]);

    await store.store("room-1", state);

    const loaded = await store.load("room-1");
    expect(loaded).toEqual(state);

    const roomsDir = path.join(tempDir, "rooms");
    const roomEntries = await fs.readdir(roomsDir);
    expect(roomEntries).toHaveLength(1);

    const metadata = JSON.parse(await fs.readFile(path.join(roomsDir, roomEntries[0]!, "metadata.json"), "utf8")) as {
      roomId: string;
      byteLength: number;
      updatedAt: string;
    };
    expect(metadata.roomId).toBe("room-1");
    expect(metadata.byteLength).toBe(4);
    expect(typeof metadata.updatedAt).toBe("string");
  });

  it("returns null for rooms that have never been stored", async () => {
    const provider = new LocalFilesystemProvider(tempDir);
    const store = new CollabObjectStore(provider);
    expect(await store.load("missing-room")).toBeNull();
  });
});

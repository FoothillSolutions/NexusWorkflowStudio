import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { CollabObjectStore } from "../collaboration/object-store";

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
    const store = new CollabObjectStore(tempDir);
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
    const store = new CollabObjectStore(tempDir);
    expect(await store.load("missing-room")).toBeNull();
  });

  it("pruneOlderThan removes rooms older than the TTL and keeps fresh ones", async () => {
    const store = new CollabObjectStore(tempDir);
    await store.store("stale-room", new Uint8Array([1]));
    await store.store("fresh-room", new Uint8Array([2]));

    // Backdate the stale room's metadata by 10 days.
    const roomsDir = path.join(tempDir, "rooms");
    const entries = await fs.readdir(roomsDir);
    for (const entry of entries) {
      const metaPath = path.join(roomsDir, entry, "metadata.json");
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as { roomId: string; updatedAt: string };
      if (meta.roomId === "stale-room") {
        meta.updatedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
        await fs.writeFile(metaPath, JSON.stringify(meta));
      }
    }

    const result = await store.pruneOlderThan(3 * 24 * 60 * 60 * 1000);
    expect(result.pruned).toBe(1);
    expect(result.kept).toBe(1);

    expect(await store.load("stale-room")).toBeNull();
    expect(await store.load("fresh-room")).toEqual(new Uint8Array([2]));
  });

  it("pruneOlderThan skips rooms with missing/malformed metadata", async () => {
    const store = new CollabObjectStore(tempDir);
    await store.store("legit-room", new Uint8Array([1]));

    // Inject a stray directory without metadata.
    const roomsDir = path.join(tempDir, "rooms");
    await fs.mkdir(path.join(roomsDir, "orphan"), { recursive: true });
    await fs.writeFile(path.join(roomsDir, "orphan", "state.bin"), new Uint8Array([0]));

    const result = await store.pruneOlderThan(24 * 60 * 60 * 1000);
    expect(result.pruned).toBe(0);
    expect(result.kept).toBe(2);
  });

  it("pruneOlderThan is a no-op when the TTL is zero or negative", async () => {
    const store = new CollabObjectStore(tempDir);
    await store.store("room", new Uint8Array([1]));

    expect(await store.pruneOlderThan(0)).toEqual({ pruned: 0, kept: 0 });
    expect(await store.pruneOlderThan(-1)).toEqual({ pruned: 0, kept: 0 });
    expect(await store.load("room")).toEqual(new Uint8Array([1]));
  });
});

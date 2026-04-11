import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { LocalFilesystemProvider } from "../local-provider";

let tempDir = "";
let provider: LocalFilesystemProvider;

describe("LocalFilesystemProvider", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-storage-test-"));
    provider = new LocalFilesystemProvider(tempDir);
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("read/write", () => {
    it("round-trips string content", async () => {
      await provider.write("test/file.txt", "hello world");
      const result = await provider.read("test/file.txt");
      expect(result).toBe("hello world");
    });

    it("returns null for non-existent key", async () => {
      const result = await provider.read("missing/file.txt");
      expect(result).toBeNull();
    });

    it("handles empty string content", async () => {
      await provider.write("empty.txt", "");
      const result = await provider.read("empty.txt");
      expect(result).toBe("");
    });
  });

  describe("readBytes/writeBytes", () => {
    it("round-trips binary content", async () => {
      const data = new Uint8Array([0, 1, 2, 255, 128, 64]);
      await provider.writeBytes("bin/data.bin", data);
      const result = await provider.readBytes("bin/data.bin");
      expect(result).toEqual(data);
    });

    it("returns null for non-existent key", async () => {
      const result = await provider.readBytes("missing.bin");
      expect(result).toBeNull();
    });
  });

  describe("writeAtomic", () => {
    it("produces correct file with string content", async () => {
      await provider.writeAtomic("atomic.txt", "atomic content");
      const result = await provider.read("atomic.txt");
      expect(result).toBe("atomic content");
    });

    it("produces correct file with binary content", async () => {
      const data = new Uint8Array([10, 20, 30]);
      await provider.writeAtomic("atomic.bin", data);
      const result = await provider.readBytes("atomic.bin");
      expect(result).toEqual(data);
    });

    it("does not leave temp file behind", async () => {
      await provider.writeAtomic("clean.txt", "data");
      const files = await provider.list(".");
      expect(files).not.toContain("clean.txt.tmp");
    });
  });

  describe("delete", () => {
    it("returns true for existing file", async () => {
      await provider.write("del.txt", "data");
      const result = await provider.delete("del.txt");
      expect(result).toBe(true);
      expect(await provider.exists("del.txt")).toBe(false);
    });

    it("returns false for missing file", async () => {
      const result = await provider.delete("missing.txt");
      expect(result).toBe(false);
    });
  });

  describe("deleteTree", () => {
    it("removes directory recursively", async () => {
      await provider.write("tree/a.txt", "a");
      await provider.write("tree/sub/b.txt", "b");
      const result = await provider.deleteTree("tree");
      expect(result).toBe(true);
      expect(await provider.exists("tree")).toBe(false);
    });

    it("returns false for non-existent path", async () => {
      const result = await provider.deleteTree("nope");
      expect(result).toBe(false);
    });
  });

  describe("exists", () => {
    it("returns true for existing file", async () => {
      await provider.write("exists.txt", "data");
      expect(await provider.exists("exists.txt")).toBe(true);
    });

    it("returns false for missing file", async () => {
      expect(await provider.exists("nope.txt")).toBe(false);
    });
  });

  describe("stat", () => {
    it("returns correct metadata", async () => {
      await provider.write("stat.txt", "hello");
      const meta = await provider.stat("stat.txt");
      expect(meta).not.toBeNull();
      expect(meta!.size).toBe(5);
      expect(typeof meta!.lastModified).toBe("string");
    });

    it("returns null for missing file", async () => {
      const meta = await provider.stat("missing.txt");
      expect(meta).toBeNull();
    });
  });

  describe("list", () => {
    it("returns file names under prefix", async () => {
      await provider.write("dir/a.json", "{}");
      await provider.write("dir/b.json", "{}");
      await fs.mkdir(path.join(tempDir, "dir", "subdir"), { recursive: true });
      const files = await provider.list("dir");
      expect(files.sort()).toEqual(["a.json", "b.json"]);
    });

    it("returns empty array for non-existent prefix", async () => {
      const files = await provider.list("nope");
      expect(files).toEqual([]);
    });
  });

  describe("listDirectories", () => {
    it("returns only directories", async () => {
      await provider.write("parent/file.txt", "data");
      await fs.mkdir(path.join(tempDir, "parent", "child1"), { recursive: true });
      await fs.mkdir(path.join(tempDir, "parent", "child2"), { recursive: true });
      const dirs = await provider.listDirectories("parent");
      expect(dirs.sort()).toEqual(["child1", "child2"]);
    });

    it("returns empty array for non-existent prefix", async () => {
      const dirs = await provider.listDirectories("nope");
      expect(dirs).toEqual([]);
    });
  });

  describe("path traversal prevention", () => {
    it("rejects keys with ..", async () => {
      await expect(provider.read("../../etc/passwd")).rejects.toThrow("Invalid storage key");
    });

    it("rejects absolute paths", async () => {
      await expect(provider.read("/etc/passwd")).rejects.toThrow("Invalid storage key");
    });
  });
});

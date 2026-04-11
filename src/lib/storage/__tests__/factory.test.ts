import { afterEach, describe, expect, it } from "bun:test";
import {
  getStorageProvider,
  registerStorageProvider,
  resetStorageProvider,
} from "../factory";
import { LocalFilesystemProvider } from "../local-provider";
import { resetStorageConfigCache } from "../config";
import type { StorageProvider } from "../types";

describe("Storage Factory", () => {
  afterEach(() => {
    resetStorageProvider();
    resetStorageConfigCache();
  });

  it("returns a LocalFilesystemProvider by default", () => {
    const provider = getStorageProvider();
    expect(provider).toBeInstanceOf(LocalFilesystemProvider);
  });

  it("caches the provider instance", () => {
    const a = getStorageProvider();
    const b = getStorageProvider();
    expect(a).toBe(b);
  });

  it("resets the cache with resetStorageProvider", () => {
    const a = getStorageProvider();
    resetStorageProvider();
    const b = getStorageProvider();
    expect(a).not.toBe(b);
  });

  it("supports custom provider registration", () => {
    const mockProvider: StorageProvider = {
      read: async () => null,
      readBytes: async () => null,
      write: async () => {},
      writeBytes: async () => {},
      writeAtomic: async () => {},
      delete: async () => false,
      deleteTree: async () => false,
      exists: async () => false,
      stat: async () => null,
      list: async () => [],
      listDirectories: async () => [],
    };

    registerStorageProvider("mock", () => mockProvider);
    process.env.NEXUS_STORAGE_PROVIDER = "mock";
    resetStorageConfigCache();
    resetStorageProvider();

    const provider = getStorageProvider();
    expect(provider).toBe(mockProvider);

    delete process.env.NEXUS_STORAGE_PROVIDER;
  });

  it("throws for unknown provider type", () => {
    process.env.NEXUS_STORAGE_PROVIDER = "nonexistent";
    resetStorageConfigCache();
    resetStorageProvider();

    expect(() => getStorageProvider()).toThrow("Unknown storage provider type");

    delete process.env.NEXUS_STORAGE_PROVIDER;
  });
});

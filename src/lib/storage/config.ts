import path from "node:path";
import type { StorageProviderType } from "./types";

export interface StorageConfig {
  providerType: StorageProviderType;
  rootDir: string;
}

let cachedConfig: StorageConfig | null = null;

export function getStorageConfig(): StorageConfig {
  if (cachedConfig) return cachedConfig;

  const brainDataDir =
    process.env.NEXUS_BRAIN_DATA_DIR ?? path.join(process.cwd(), ".nexus-brain");

  cachedConfig = {
    providerType: process.env.NEXUS_STORAGE_PROVIDER ?? "local",
    rootDir: process.env.NEXUS_STORAGE_ROOT ?? brainDataDir,
  };

  return cachedConfig;
}

export function resetStorageConfigCache(): void {
  cachedConfig = null;
}

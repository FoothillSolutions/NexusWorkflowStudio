import path from "node:path";
import { getBrainConfig } from "@/lib/brain/config";

export interface LibraryStoreConfig {
  dataDir: string;
  tokenSecret: string;
}

let cachedConfig: LibraryStoreConfig | null = null;

export function getLibraryConfig(): LibraryStoreConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    dataDir: process.env.NEXUS_LIBRARY_DATA_DIR ?? path.join(process.cwd(), ".nexus-library"),
    tokenSecret: getBrainConfig().tokenSecret,
  };

  return cachedConfig;
}

export function resetLibraryConfigCache(): void {
  cachedConfig = null;
}

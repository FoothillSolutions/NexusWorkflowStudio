import { getStorageConfig } from "./config";
import { LocalFilesystemProvider } from "./local-provider";
import type { StorageProvider } from "./types";

type ProviderFactory = () => StorageProvider;

const providerFactories = new Map<string, ProviderFactory>();

providerFactories.set("local", () => {
  const config = getStorageConfig();
  return new LocalFilesystemProvider(config.rootDir);
});

let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cachedProvider) return cachedProvider;

  const config = getStorageConfig();
  const factory = providerFactories.get(config.providerType);

  if (!factory) {
    const available = Array.from(providerFactories.keys()).join(", ");
    throw new Error(
      `Unknown storage provider type: "${config.providerType}". Available providers: ${available}`,
    );
  }

  cachedProvider = factory();
  return cachedProvider;
}

export function resetStorageProvider(): void {
  cachedProvider = null;
}

export function registerStorageProvider(
  type: string,
  factory: ProviderFactory,
): void {
  providerFactories.set(type, factory);
}

import path from "node:path";

export interface BrainConfig {
  dataDir: string;
  tokenSecret: string;
}

let cachedConfig: BrainConfig | null = null;

export function getBrainConfig(): BrainConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    dataDir: process.env.NEXUS_BRAIN_DATA_DIR ?? path.join(process.cwd(), ".nexus-brain"),
    tokenSecret: process.env.NEXUS_BRAIN_TOKEN_SECRET ?? "nexus-brain-dev-secret",
  };

  return cachedConfig;
}

export function resetBrainConfigCache(): void {
  cachedConfig = null;
}

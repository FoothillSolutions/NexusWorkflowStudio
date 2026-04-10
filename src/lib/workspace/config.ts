import path from "node:path";

export interface WorkspaceConfig {
  dataDir: string;
}

let cachedConfig: WorkspaceConfig | null = null;

export function getWorkspaceConfig(): WorkspaceConfig {
  if (cachedConfig) return cachedConfig;

  const brainDataDir = process.env.NEXUS_BRAIN_DATA_DIR ?? path.join(process.cwd(), ".nexus-brain");
  cachedConfig = {
    dataDir: path.join(brainDataDir, "workspaces"),
  };

  return cachedConfig;
}

export function resetWorkspaceConfigCache(): void {
  cachedConfig = null;
}

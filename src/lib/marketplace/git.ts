import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MarketplaceSourceConfig } from "./types";

const execFile = promisify(execFileCb);

const GIT_TIMEOUT_MS = 60_000;

/** Returns the local directory for a marketplace's cloned repo. */
export function getMarketplaceDir(name: string): string {
  const cacheRoot =
    process.env.NEXUS_MARKETPLACE_CACHE_DIR ?? "/tmp/nexus-marketplaces";
  return join(cacheRoot, name);
}

function isLocalPath(source: string): boolean {
  return (
    source.startsWith("/") ||
    source.startsWith("./") ||
    source.startsWith("../")
  );
}

/**
 * Ensures a marketplace is available locally.
 * - Local path: validates existence, returns as-is
 * - Remote URL: shallow-clones if not present, fetches+resets if already cloned
 *
 * Returns the resolved local directory path.
 */
export async function ensureMarketplace(
  config: MarketplaceSourceConfig,
): Promise<string> {
  if (isLocalPath(config.source)) {
    if (!existsSync(config.source)) {
      throw new Error(
        `Local marketplace path does not exist: ${config.source}`,
      );
    }
    return config.source;
  }

  const localDir = getMarketplaceDir(config.name);
  const gitDir = join(localDir, ".git");
  const opts = { timeout: GIT_TIMEOUT_MS };

  if (!existsSync(gitDir)) {
    // Fresh shallow clone
    const args = ["clone", "--depth=1"];
    if (config.ref) args.push("--branch", config.ref);
    args.push("--", config.source, localDir);
    await execFile("git", args, opts);
  } else {
    // Pull latest
    const fetchArgs = ["fetch", "--depth=1", "origin"];
    if (config.ref) fetchArgs.push(config.ref);
    await execFile("git", fetchArgs, { ...opts, cwd: localDir });
    await execFile("git", ["reset", "--hard", "FETCH_HEAD"], {
      ...opts,
      cwd: localDir,
    });
  }

  return localDir;
}

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadMarketplaceConfig } from "./config";
import { ensureMarketplace } from "./git";
import { parseMarketplace } from "./parser";
import type {
  MarketplaceJson,
  MarketplaceLibraryItem,
  MarketplaceWorkflowEntry,
  MarketplaceState,
  MarketplaceSourceConfig,
} from "./types";

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  items: MarketplaceLibraryItem[];
  workflows: MarketplaceWorkflowEntry[];
  state: MarketplaceState;
}

const cache = new Map<string, CacheEntry>();
let refreshing = false;

// ── Internal ──────────────────────────────────────────────────────────────────

/**
 * Reads the canonical marketplace name from `.claude-plugin/marketplace.json`.
 * Falls back to the provided slug if the file is missing or unparseable.
 */
function readMarketplaceName(localDir: string, fallback: string): string {
  const manifestPath = join(localDir, ".claude-plugin", "marketplace.json");
  if (!existsSync(manifestPath)) return fallback;
  try {
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf-8"),
    ) as MarketplaceJson;
    return typeof manifest.name === "string" && manifest.name
      ? manifest.name
      : fallback;
  } catch {
    return fallback;
  }
}

async function refreshOne(config: MarketplaceSourceConfig): Promise<void> {
  // Mark pending using the config slug (preserve stale items)
  cache.set(config.name, {
    items: cache.get(config.name)?.items ?? [],
    workflows: cache.get(config.name)?.workflows ?? [],
    state: {
      name: config.name,
      source: config.source,
      status: "pending",
      itemCount: cache.get(config.name)?.state.itemCount ?? 0,
      lastRefreshed: cache.get(config.name)?.state.lastRefreshed ?? null,
      error: null,
    },
  });

  try {
    const localDir = await ensureMarketplace(config);

    // Resolve canonical name from the repo's marketplace.json
    const canonicalName = readMarketplaceName(localDir, config.name);
    if (canonicalName !== config.name) {
      console.info(
        `[marketplace] Resolved name "${canonicalName}" from manifest (slug: "${config.name}")`,
      );
      // Re-key cache: remove slug entry if canonical differs
      cache.delete(config.name);
    }

    const { items, workflows } = parseMarketplace(localDir, canonicalName, config.nexusFolder);

    cache.set(canonicalName, {
      items,
      workflows,
      state: {
        name: canonicalName,
        source: config.source,
        status: "ok",
        itemCount: items.length + workflows.length,
        lastRefreshed: new Date().toISOString(),
        error: null,
      },
    });

    console.info(
      `[marketplace] "${canonicalName}" refreshed: ${items.length} items, ${workflows.length} workflows`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[marketplace] Failed to refresh "${config.name}":`, err);

    cache.set(config.name, {
      items: cache.get(config.name)?.items ?? [],
      workflows: cache.get(config.name)?.workflows ?? [],
      state: {
        name: config.name,
        source: config.source,
        status: "error",
        itemCount: (cache.get(config.name)?.items.length ?? 0) + (cache.get(config.name)?.workflows.length ?? 0),
        lastRefreshed: cache.get(config.name)?.state.lastRefreshed ?? null,
        error: errorMsg,
      },
    });
  }
}

async function doRefreshAll(): Promise<void> {
  refreshing = true;
  try {
    const configs = loadMarketplaceConfig();
    if (configs.length === 0) {
      console.info("[marketplace] No marketplaces configured");
      return;
    }
    for (const config of configs) {
      await refreshOne(config);
    }
  } finally {
    refreshing = false;
  }
}

// ── Eager init on module load ─────────────────────────────────────────────────
// Runs automatically when the module is first imported (server start).

doRefreshAll().catch((err) =>
  console.error("[marketplace] Initial refresh failed:", err),
);

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all marketplace items from all configured marketplaces. */
export function getAllMarketplaceItems(): MarketplaceLibraryItem[] {
  const all: MarketplaceLibraryItem[] = [];
  for (const { items } of cache.values()) {
    all.push(...items);
  }
  return all;
}

/** Returns all marketplace workflows from all configured marketplaces. */
export function getAllMarketplaceWorkflows(): MarketplaceWorkflowEntry[] {
  const all: MarketplaceWorkflowEntry[] = [];
  for (const { workflows } of cache.values()) {
    all.push(...workflows);
  }
  return all;
}

/** Returns the current state of all marketplaces. */
export function getMarketplaceStates(): MarketplaceState[] {
  return Array.from(cache.values()).map((e) => e.state);
}

/** Returns true while a refresh (init or manual) is in progress. */
export function getIsRefreshing(): boolean {
  return refreshing;
}

/** Triggers a background refresh of all marketplaces. */
export function triggerRefresh(): void {
  if (refreshing) return; // Don't stack refreshes
  doRefreshAll().catch((err) =>
    console.error("[marketplace] Background refresh failed:", err),
  );
}

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { MarketplaceSourceConfig } from "./types";

const DEFAULT_CONFIG_PATHS = [
  process.env.NEXUS_MARKETPLACES_FILE,
  resolve(process.cwd(), "nexus-marketplaces.json"),
].filter(Boolean) as string[];

// ── JSON array parsing (used by file-based config) ───────────────────────────

function parseConfigArray(
  raw: string,
  source: string,
): MarketplaceSourceConfig[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`[marketplace] Config from ${source} must be a JSON array`);
      return [];
    }
    return parsed.filter(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as MarketplaceSourceConfig).name === "string" &&
        typeof (entry as MarketplaceSourceConfig).source === "string",
    ) as MarketplaceSourceConfig[];
  } catch (err) {
    console.error(`[marketplace] Failed to parse config from ${source}:`, err);
    return [];
  }
}

// ── Comma-separated parsing (used by NEXUS_MARKETPLACES env var) ─────────────

function normalizeSource(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function slugFromSource(source: string): string {
  // Extract the last non-empty path segment
  const segments = source.split("/").filter(Boolean);
  const last = segments.at(-1) ?? "marketplace";
  // Strip .git suffix only for the slug, then lowercase and sanitize
  return last
    .replace(/\.git$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCommaSeparated(raw: string): MarketplaceSourceConfig[] {
  const entries = raw.split(",").filter((s) => s.trim().length > 0);
  const configs: MarketplaceSourceConfig[] = [];
  const slugCounts = new Map<string, number>();

  for (const entry of entries) {
    const trimmed = entry.trim();

    // Support optional #ref suffix (split on last #)
    const hashIdx = trimmed.lastIndexOf("#");
    let sourcePart: string;
    let ref: string | undefined;

    if (hashIdx > 0) {
      sourcePart = trimmed.slice(0, hashIdx);
      ref = trimmed.slice(hashIdx + 1);
      if (!ref) ref = undefined;
    } else {
      sourcePart = trimmed;
    }

    const source = normalizeSource(sourcePart);
    if (!source) continue;

    let slug = slugFromSource(source);
    if (!slug) slug = "marketplace";

    // Handle duplicate slugs
    const count = (slugCounts.get(slug) ?? 0) + 1;
    slugCounts.set(slug, count);
    const name = count > 1 ? `${slug}-${count}` : slug;

    configs.push({ name, source, ...(ref ? { ref } : {}) });
  }

  return configs;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function loadMarketplaceConfig(): MarketplaceSourceConfig[] {
  // 1. Inline env var (comma-separated sources)
  if (process.env.NEXUS_MARKETPLACES) {
    const configs = parseCommaSeparated(process.env.NEXUS_MARKETPLACES);
    console.info(
      `[marketplace] Loaded ${configs.length} source(s) from NEXUS_MARKETPLACES env`,
    );
    return configs;
  }

  // 2. Config file — JSON array (first found)
  for (const path of DEFAULT_CONFIG_PATHS) {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        return parseConfigArray(raw, path);
      } catch (err) {
        console.error(`[marketplace] Failed to read config file ${path}:`, err);
      }
    }
  }

  return [];
}

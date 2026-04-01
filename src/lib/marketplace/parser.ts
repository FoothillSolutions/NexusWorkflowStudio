import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type {
  MarketplaceJson,
  MarketplaceLibraryItem,
  AgentNodePayload,
  SkillNodePayload,
  PromptNodePayload,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(
  marketplace: string,
  plugin: string,
  nodeType: string,
  name: string,
): string {
  return `mp:${marketplace}:${plugin}:${nodeType}:${name}`;
}

interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

function parseMarkdownFile(raw: string): ParsedMarkdown {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw.trim() };
  try {
    const fm = (yaml.load(match[1]) as Record<string, unknown>) ?? {};
    return { frontmatter: fm, body: match[2].trim() };
  } catch {
    return { frontmatter: {}, body: raw.trim() };
  }
}

function str(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

// ── Agent parser ──────────────────────────────────────────────────────────────

function parseAgentMarkdown(
  raw: string,
  fileName: string,
  marketplaceName: string,
  pluginName: string,
  refreshedAt: string,
): MarketplaceLibraryItem | null {
  const { frontmatter: fm, body } = parseMarkdownFile(raw);
  const baseName = fileName.replace(/\.md$/i, "");

  const name = str(fm.name, baseName);
  const description = str(fm.description);
  const model = str(fm.model, "inherit");
  const memory = str(fm.memory, "-");
  const temperature = Math.min(1, Math.max(0, Number(fm.temperature ?? 0) || 0));
  const color = str(fm.color, "#5f27cd");

  // Parse tools map: { bash: false, read: true } → disabledTools = ["bash"]
  const disabledTools: string[] = [];
  if (fm.tools && typeof fm.tools === "object" && !Array.isArray(fm.tools)) {
    for (const [tool, enabled] of Object.entries(fm.tools as Record<string, unknown>)) {
      if (enabled === false) disabledTools.push(tool);
    }
  }

  const payload: AgentNodePayload = {
    type: "agent",
    label: name,
    name: `${pluginName}-${baseName}`,
    description,
    promptText: body,
    detectedVariables: [],
    model,
    memory,
    temperature,
    color,
    disabledTools,
    parameterMappings: [],
    variableMappings: {},
  };

  return {
    id: makeId(marketplaceName, pluginName, "agent", baseName),
    name,
    category: "agent",
    nodeType: "agent",
    savedAt: refreshedAt,
    updatedAt: refreshedAt,
    nodeData: payload,
    description,
    marketplaceName,
    pluginName,
    readonly: true,
  };
}

// ── Skill parser ──────────────────────────────────────────────────────────────

function parseSkillMarkdown(
  raw: string,
  skillDirName: string,
  marketplaceName: string,
  pluginName: string,
  refreshedAt: string,
): MarketplaceLibraryItem | null {
  const { frontmatter: fm, body } = parseMarkdownFile(raw);

  const name = str(fm.name, skillDirName);
  const description = str(fm.description);

  const payload: SkillNodePayload = {
    type: "skill",
    label: name,
    name: `${pluginName}-${skillDirName}`,
    skillName: skillDirName,
    description,
    promptText: body,
    detectedVariables: [],
    variableMappings: {},
    metadata: [],
  };

  return {
    id: makeId(marketplaceName, pluginName, "skill", skillDirName),
    name,
    category: "skill",
    nodeType: "skill",
    savedAt: refreshedAt,
    updatedAt: refreshedAt,
    nodeData: payload,
    description,
    marketplaceName,
    pluginName,
    readonly: true,
  };
}

// ── Command (prompt) parser ───────────────────────────────────────────────────

function parseCommandMarkdown(
  raw: string,
  fileName: string,
  marketplaceName: string,
  pluginName: string,
  refreshedAt: string,
): MarketplaceLibraryItem | null {
  const { frontmatter: fm, body } = parseMarkdownFile(raw);
  const baseName = fileName.replace(/\.md$/i, "");

  const name = str(fm.name, baseName);
  const description = str(fm.description);

  const payload: PromptNodePayload = {
    type: "prompt",
    label: name,
    name: `${pluginName}-${baseName}`,
    promptText: body,
    detectedVariables: [],
  };

  return {
    id: makeId(marketplaceName, pluginName, "prompt", baseName),
    name,
    category: "prompt",
    nodeType: "prompt",
    savedAt: refreshedAt,
    updatedAt: refreshedAt,
    nodeData: payload,
    description,
    marketplaceName,
    pluginName,
    readonly: true,
  };
}

// ── Plugin parser ─────────────────────────────────────────────────────────────

function parsePlugin(
  pluginDir: string,
  pluginName: string,
  marketplaceName: string,
  refreshedAt: string,
): MarketplaceLibraryItem[] {
  const items: MarketplaceLibraryItem[] = [];

  // agents/*.md
  const agentsDir = join(pluginDir, "agents");
  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir)) {
      if (!file.endsWith(".md")) continue;
      try {
        const raw = readFileSync(join(agentsDir, file), "utf-8");
        const item = parseAgentMarkdown(raw, file, marketplaceName, pluginName, refreshedAt);
        if (item) items.push(item);
      } catch (err) {
        console.warn(`[marketplace] Failed to parse agent ${file} in ${pluginDir}:`, err);
      }
    }
  }

  // skills/*/SKILL.md
  const skillsDir = join(pluginDir, "skills");
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(skillsDir, entry.name, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      try {
        const raw = readFileSync(skillFile, "utf-8");
        const item = parseSkillMarkdown(raw, entry.name, marketplaceName, pluginName, refreshedAt);
        if (item) items.push(item);
      } catch (err) {
        console.warn(`[marketplace] Failed to parse skill ${entry.name} in ${pluginDir}:`, err);
      }
    }
  }

  // commands/*.md
  const commandsDir = join(pluginDir, "commands");
  if (existsSync(commandsDir)) {
    for (const file of readdirSync(commandsDir)) {
      if (!file.endsWith(".md")) continue;
      try {
        const raw = readFileSync(join(commandsDir, file), "utf-8");
        const item = parseCommandMarkdown(raw, file, marketplaceName, pluginName, refreshedAt);
        if (item) items.push(item);
      } catch (err) {
        console.warn(`[marketplace] Failed to parse command ${file} in ${pluginDir}:`, err);
      }
    }
  }

  return items;
}

// ── Marketplace parser (public API) ──────────────────────────────────────────

export function parseMarketplace(
  marketplaceDir: string,
  marketplaceName: string,
): MarketplaceLibraryItem[] {
  const manifestPath = join(marketplaceDir, ".claude-plugin", "marketplace.json");
  if (!existsSync(manifestPath)) {
    console.warn(`[marketplace] No .claude-plugin/marketplace.json in ${marketplaceDir}`);
    return [];
  }

  let manifest: MarketplaceJson;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as MarketplaceJson;
  } catch (err) {
    console.error(`[marketplace] Failed to parse marketplace.json in ${marketplaceDir}:`, err);
    return [];
  }

  const pluginRoot = manifest.metadata?.pluginRoot ?? ".";
  const refreshedAt = new Date().toISOString();
  const items: MarketplaceLibraryItem[] = [];

  for (const pluginDef of manifest.plugins) {
    // Only process relative-path (string) sources
    if (typeof pluginDef.source !== "string") continue;
    if (!pluginDef.source.startsWith("./") && !pluginDef.source.startsWith("../")) continue;

    // Resolve plugin dir against pluginRoot
    const resolvedSource = join(
      marketplaceDir,
      pluginRoot === "." ? "" : pluginRoot,
      pluginDef.source,
    );

    if (!existsSync(resolvedSource)) {
      console.warn(`[marketplace] Plugin dir not found: ${resolvedSource}`);
      continue;
    }

    try {
      const pluginItems = parsePlugin(resolvedSource, pluginDef.name, marketplaceName, refreshedAt);
      items.push(...pluginItems);
    } catch (err) {
      console.warn(`[marketplace] Failed to parse plugin "${pluginDef.name}":`, err);
    }
  }

  return items;
}

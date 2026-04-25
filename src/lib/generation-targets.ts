export type GenerationTargetId = "opencode" | "pi" | "claude-code";

export interface GenerationTarget {
  id: GenerationTargetId;
  label: string;
  rootDir: string;
  compatibility: string;
  description: string;
}

export const DEFAULT_GENERATION_TARGET: GenerationTargetId = "claude-code";

export const GENERATION_TARGETS: GenerationTarget[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    rootDir: ".claude",
    compatibility: "claude-code",
    description: "Generates Claude Code-friendly commands and agents.",
  },
  {
    id: "opencode",
    label: "OpenCode",
    rootDir: ".opencode",
    compatibility: "opencode",
    description: "Generates .opencode commands, agents, skills, and docs.",
  },
  {
    id: "pi",
    label: "PI",
    rootDir: ".pi",
    compatibility: "pi",
    description: "Generates the PI workflow folder layout.",
  },
];

const GENERATION_TARGETS_BY_ID = new Map(
  GENERATION_TARGETS.map((target) => [target.id, target]),
);

export function getGenerationTarget(
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): GenerationTarget {
  return GENERATION_TARGETS_BY_ID.get(target) ?? GENERATION_TARGETS_BY_ID.get(DEFAULT_GENERATION_TARGET)!;
}

export function sanitizeGeneratedName(raw: string, fallback = "workflow"): string {
  return (
    raw
      .replace(/[^a-z0-9\-_ ]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || fallback
  );
}

export function buildGeneratedCommandFilePath(
  commandName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  return `${getGenerationTarget(target).rootDir}/commands/${commandName}.md`;
}

export function buildGeneratedAgentFilePath(
  agentName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  return `${getGenerationTarget(target).rootDir}/agents/${agentName}.md`;
}

export function buildGeneratedSkillFilePath(
  skillName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  return `${getGenerationTarget(target).rootDir}/skills/${skillName}/SKILL.md`;
}

export function buildGeneratedSkillScriptFilePath(
  skillName: string,
  scriptFileName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  return `${getGenerationTarget(target).rootDir}/skills/${skillName}/scripts/${scriptFileName}`;
}

export function buildGeneratedDocsFilePath(
  fileName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  return `${getGenerationTarget(target).rootDir}/docs/${fileName}`;
}


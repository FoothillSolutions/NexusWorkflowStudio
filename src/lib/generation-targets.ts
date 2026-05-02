import {
  buildClaudeDocsReferencePath,
  buildClaudePluginSkillName,
  buildClaudeSkillReferencePath,
  buildClaudeSkillScriptReferencePath,
} from "@/lib/claude-plugin-export";

export type GenerationTargetId = "opencode" | "pi" | "claude-code";

export interface GenerationTarget {
  id: GenerationTargetId;
  label: string;
  rootDir: string;
  compatibility: string;
  description: string;
}

export const DEFAULT_GENERATION_TARGET: GenerationTargetId = "opencode";

export const GENERATION_TARGETS: GenerationTarget[] = [
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
  {
    id: "claude-code",
    label: "Claude/Cowork Plugin",
    rootDir: "plugin root",
    compatibility: "claude-plugin",
    description: "Exports a Claude/Cowork plugin package with bundled workflow skills, agents, docs, and Nexus JSON.",
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
  if (target === "claude-code") return "skills/run/SKILL.md";
  return `${getGenerationTarget(target).rootDir}/commands/${commandName}.md`;
}

export function buildGeneratedSubWorkflowCommandFilePath(
  commandName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  if (target === "claude-code") return `skills/${buildClaudePluginSkillName(commandName)}/SKILL.md`;
  return buildGeneratedCommandFilePath(commandName, target);
}

export function buildGeneratedAgentFilePath(
  agentName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  if (target === "claude-code") return `agents/${agentName}.md`;
  return `${getGenerationTarget(target).rootDir}/agents/${agentName}.md`;
}

export function buildGeneratedSkillFilePath(
  skillName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  if (target === "claude-code") return `skills/${skillName}/SKILL.md`;
  return `${getGenerationTarget(target).rootDir}/skills/${skillName}/SKILL.md`;
}

export function buildGeneratedSkillScriptFilePath(
  skillName: string,
  scriptFileName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  if (target === "claude-code") return `skills/${skillName}/scripts/${scriptFileName}`;
  return `${getGenerationTarget(target).rootDir}/skills/${skillName}/scripts/${scriptFileName}`;
}

export function buildGeneratedDocsFilePath(
  fileName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  if (target === "claude-code") return `docs/${fileName}`;
  return `${getGenerationTarget(target).rootDir}/docs/${fileName}`;
}

export function buildGeneratedSkillReferencePath(
  skillName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  if (target === "claude-code") return buildClaudeSkillReferencePath(skillName);
  return buildGeneratedSkillFilePath(skillName, target);
}

export function buildGeneratedSkillScriptReferencePath(
  skillName: string,
  scriptFileName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  if (target === "claude-code") return buildClaudeSkillScriptReferencePath(skillName, scriptFileName);
  return buildGeneratedSkillScriptFilePath(skillName, scriptFileName, target);
}

export function buildGeneratedDocsReferencePath(
  fileName: string,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  if (target === "claude-code") return buildClaudeDocsReferencePath(fileName);
  return buildGeneratedDocsFilePath(fileName, target);
}

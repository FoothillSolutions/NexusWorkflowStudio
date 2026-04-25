import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SkillBundle } from "@/types/library";
import {
  buildGeneratedSkillFilePath,
  DEFAULT_GENERATION_TARGET,
  getGenerationTarget,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import type { SkillNodeData } from "./types";
import { buildSkillScriptRelativePath } from "./script-utils";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function sanitiseSlug(raw: string): string | null {
  const v = raw.trim();
  return SLUG_REGEX.test(v) ? v : null;
}

function resolveSkillSlug(d: Pick<SkillNodeData, "skillName" | "label" | "name">): string | null {
  return sanitiseSlug(d.skillName ?? "")
    ?? sanitiseSlug(d.label ?? "")
    ?? sanitiseSlug(d.name ?? "");
}

export interface ConnectedSkillScript {
  label: string;
  fileName: string;
  variableName: string;
}

function buildSkillFile(
  skillName: string,
  d: SkillNodeData,
  connectedScripts: ConnectedSkillScript[] = [],
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  const lines: string[] = ["---"];

  // name = folder name (the skill node name)
  lines.push(`name: ${skillName}`);

  // description from properties panel
  lines.push(`description: ${d.description?.trim() || skillName}`);

  // compatibility
  lines.push(`compatibility: ${getGenerationTarget(target).compatibility}`);

  // metadata block — always includes workflow: github, plus user-defined entries
  const metaEntries: { key: string; value: string }[] = [
    { key: "workflow", value: "github" },
  ];
  if (Array.isArray(d.metadata)) {
    for (const entry of d.metadata) {
      const key = sanitiseSlug(entry.key ?? "");
      const val = (entry.value ?? "").trim();
      if (key && val) metaEntries.push({ key, value: val });
    }
  }
  lines.push(`metadata:`);
  for (const { key, value } of metaEntries) {
    lines.push(`  ${key}: ${value}`);
  }

  lines.push("---");
  lines.push("");
  const mappedScriptVars = Object.entries(d.variableMappings ?? {})
    .filter(([, ref]) => ref.startsWith("script:"))
    .map(([varName, ref]) => ({ varName, relativePath: buildSkillScriptRelativePath(ref.replace(/^script:/, "")) }));

  if (connectedScripts.length > 0) {
    lines.push("");
    lines.push("## Run Scripts with Bun");
    lines.push("");
    lines.push("Run the generated scripts from the repository root:");
    lines.push("");
    for (const script of connectedScripts) {
      lines.push(`- \`bun run ${getGenerationTarget(target).rootDir}/skills/${skillName}/${buildSkillScriptRelativePath(script.fileName)}\``);
    }
    lines.push("");
    lines.push(`Or change into \`${getGenerationTarget(target).rootDir}/skills/${skillName}\` and run:`);
    lines.push("");
    for (const script of connectedScripts) {
      lines.push(`- \`bun run ${buildSkillScriptRelativePath(script.fileName)}\``);
    }
  }

  if (d.promptText?.trim()) {
    lines.push("");
    lines.push(d.promptText.trim());
  }

  if (connectedScripts.length > 0) {
    lines.push("");
    lines.push("## Connected Scripts");
    lines.push("");
    for (const script of connectedScripts) {
      lines.push(`- \`${script.fileName}\` — generated from connected script node \`${script.label || script.fileName}\``);
    }
  }

  if (mappedScriptVars.length > 0) {
    lines.push("");
    lines.push("## Script Variables");
    lines.push("");
    for (const mapping of mappedScriptVars) {
      lines.push(`- \`{{${mapping.varName}}}\` → \`${mapping.relativePath}\``);
    }
  }

  return lines.join("\n") + "\n";
}

export interface SkillGeneratorOptions {
  connectedScripts?: ConnectedSkillScript[];
  target?: GenerationTargetId;
  resolvedBundle?: SkillBundle | null;
}

export const generator: NodeGeneratorModule & {
  getSkillFile?(
    nodeId: string,
    data: WorkflowNodeData,
    connectedScripts?: ConnectedSkillScript[] | GenerationTargetId | SkillGeneratorOptions,
    target?: GenerationTargetId,
  ): { path: string; content: string } | null;
} = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SkillNodeData;
    return `    ${mermaidId(nodeId)}["Skill: ${mermaidLabel(resolveSkillSlug(d) || d.label)}"]`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SkillNodeData;
    const lines = [
      `#### Skill: ${d.label || d.name}`,
      "",
      `- **Skill Name:** ${d.skillName || "_not set_"}`,
    ];
    if (d.libraryRef) {
      lines.push(`- **Library Reference:** ${d.libraryRef.scope}/${d.libraryRef.packKey ?? d.libraryRef.packId}@${d.libraryRef.packVersion} → ${d.libraryRef.skillKey ?? d.libraryRef.skillId}`);
    }
    return lines.join("\n");
  },
  getSkillFile(
    _nodeId: string,
    data: WorkflowNodeData,
    connectedScriptsOrTarget?: ConnectedSkillScript[] | GenerationTargetId | SkillGeneratorOptions,
    target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
  ) {
    const d = data as SkillNodeData;
    let connectedScripts: ConnectedSkillScript[] = [];
    let resolvedTarget: GenerationTargetId = target ?? DEFAULT_GENERATION_TARGET;
    let resolvedBundle: SkillBundle | null = null;

    if (Array.isArray(connectedScriptsOrTarget)) {
      connectedScripts = connectedScriptsOrTarget;
    } else if (typeof connectedScriptsOrTarget === "string") {
      resolvedTarget = connectedScriptsOrTarget;
    } else if (connectedScriptsOrTarget && typeof connectedScriptsOrTarget === "object") {
      connectedScripts = connectedScriptsOrTarget.connectedScripts ?? [];
      resolvedTarget = connectedScriptsOrTarget.target ?? resolvedTarget;
      resolvedBundle = connectedScriptsOrTarget.resolvedBundle ?? null;
    }

    if (resolvedBundle && d.libraryRef) {
      const skillName = resolvedBundle.skillKey || resolveSkillSlug(d) || "skill";
      return {
        path: buildGeneratedSkillFilePath(skillName, resolvedTarget),
        content: resolvedBundle.entrypoint.content,
      };
    }

    const skillName = resolveSkillSlug(d);
    if (!skillName) return null;
    return {
      path: buildGeneratedSkillFilePath(skillName, resolvedTarget),
      content: buildSkillFile(skillName, d, connectedScripts, resolvedTarget),
    };
  },
};
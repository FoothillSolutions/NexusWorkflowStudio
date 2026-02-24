import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SkillNodeData } from "./types";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function sanitiseSlug(raw: string): string | null {
  const v = raw.trim();
  return SLUG_REGEX.test(v) ? v : null;
}

function buildSkillFile(skillName: string, d: SkillNodeData): string {
  const lines: string[] = ["---"];

  // name = folder name (the skill node name)
  lines.push(`name: ${skillName}`);

  // description from properties panel
  lines.push(`description: ${d.description?.trim() || skillName}`);

  // compatibility
  lines.push(`compatibility: opencode`);

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
  if (d.promptText?.trim()) lines.push(d.promptText.trim());
  return lines.join("\n") + "\n";
}

export const generator: NodeGeneratorModule & {
  getSkillFile?(nodeId: string, data: WorkflowNodeData): { path: string; content: string } | null;
} = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SkillNodeData;
    return `    ${mermaidId(nodeId)}["Skill: ${mermaidLabel(d.skillName || d.label)}"]`;
  },
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SkillNodeData;
    return [
      `#### Skill: ${d.label || d.name}`,
      "",
      `- **Skill Name:** ${d.skillName || "_not set_"}`,
      `- **Project:** ${d.projectName || "_not set_"}`,
    ].join("\n");
  },
  getSkillFile(_nodeId: string, data: WorkflowNodeData) {
    const d = data as SkillNodeData;
    const skillName = d.skillName?.trim() || d.name?.trim();
    if (!skillName) return null;
    return {
      path: `.opencode/skills/${skillName}/SKILL.md`,
      content: buildSkillFile(skillName, d),
    };
  },
};
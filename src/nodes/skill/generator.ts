import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SkillNodeData } from "./types";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function sanitiseSlug(raw: string): string | null {
  const v = raw.trim();
  return SLUG_REGEX.test(v) ? v : null;
}

function buildSkillFile(d: SkillNodeData): string {
  const lines: string[] = ["---"];
  if (d.description?.trim()) lines.push(`description: ${d.description.trim()}`);
  if (Array.isArray(d.metadata)) {
    for (const entry of d.metadata) {
      const key = sanitiseSlug(entry.key ?? "");
      const val = sanitiseSlug(entry.value ?? "");
      if (key && val) lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---");
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
      path: `.opencode/skills/${skillName}.md`,
      content: buildSkillFile(d),
    };
  },
};
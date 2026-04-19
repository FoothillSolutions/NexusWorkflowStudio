import type { AgentHandoffContext, NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import { NODE_ACCENT } from "@/lib/node-colors";
import {
  buildGeneratedAgentFilePath,
  buildGeneratedDocsFilePath,
  buildGeneratedSkillFilePath,
  DEFAULT_GENERATION_TARGET,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import type { SubAgentNodeData } from "./types";
import { SubAgentModel, SubAgentMemory } from "./types";

/**
 * Claude Code's `.claude/agents/*.md` frontmatter expects the short names
 * `sonnet`, `opus`, `haiku`, or `inherit` — not the provider-prefixed ids
 * (e.g. `github-copilot/claude-sonnet-4.6`) used elsewhere in the app.
 * Returns null when the model can't be mapped to a Claude Code tier
 * (non-Claude models) so the caller can omit the line.
 */
function mapModelForClaudeCode(model: string): string | null {
  const lower = model.toLowerCase();
  if (lower.includes("haiku")) return "haiku";
  if (lower.includes("opus")) return "opus";
  if (lower.includes("sonnet")) return "sonnet";
  return null;
}

/**
 * Build the frontmatter + prompt content for a .opencode/agents/<name>.md file.
 */
export function buildAgentFile(
  nodeId: string,
  d: SubAgentNodeData,
  connectedSkillNames?: string[],
  connectedDocNames?: string[],
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
  handoff?: AgentHandoffContext,
): string {
  const agentName = d.name || `agent-${nodeId}`;

  // --- frontmatter ---
  const lines: string[] = ["---"];
  lines.push(`description: ${d.description || d.label || agentName}`);
  lines.push(`mode: subagent`);
  lines.push(`hidden: true`);

  if (d.model && d.model !== SubAgentModel.Inherit) {
    if (target === "claude-code") {
      const mapped = mapModelForClaudeCode(d.model);
      if (mapped) lines.push(`model: ${mapped}`);
    } else {
      lines.push(`model: ${d.model}`);
    }
  }

  if (d.memory && d.memory !== SubAgentMemory.Default) {
    lines.push(`memory: ${d.memory}`);
  }

  // Only emit tools block if some are disabled
  if (Array.isArray(d.disabledTools) && d.disabledTools.length > 0) {
    lines.push(`tools:`);
    for (const tool of d.disabledTools) {
      lines.push(`  ${tool}: false`);
    }
  }

  // Emit connected skills
  if (connectedSkillNames && connectedSkillNames.length > 0) {
    lines.push(`skills:`);
    for (const name of connectedSkillNames) {
      lines.push(`  - ${name}`);
    }
  }

  // Emit connected documents
  if (connectedDocNames && connectedDocNames.length > 0) {
    lines.push(`docs:`);
    for (const name of connectedDocNames) {
      lines.push(`  - ${name}`);
    }
  }

  if (d.temperature && d.temperature > 0) {
    lines.push(`temperature: ${parseFloat(d.temperature.toFixed(1))}`);
  }

  lines.push(`color: "${d.color || NODE_ACCENT.agent}"`);

  lines.push("---");
  lines.push("");

  // Startup Handoff — upstream handoff feeding INTO this agent.
  if (handoff?.upstream) {
    const { mode, filePath, payloadTemplate, handoffNodeId } = handoff.upstream;
    lines.push("## Startup Handoff");
    lines.push("");
    if (mode === "file") {
      lines.push(
        `Before doing anything else, READ \`${filePath}\` (produced by the upstream handoff node \`${handoffNodeId}\`).`,
      );
      lines.push("The expected schema is:");
      lines.push("```");
      lines.push(payloadTemplate);
      lines.push("```");
      lines.push("If the file is missing, stop and report the missing handoff.");
    } else {
      lines.push(
        `An upstream agent has prepended a Handoff Payload to your prompt via handoff node \`${handoffNodeId}\`. Read it before doing anything else.`,
      );
      lines.push("The expected schema is:");
      lines.push("```");
      lines.push(payloadTemplate);
      lines.push("```");
    }
    lines.push("");
  }

  // Emit variable mappings section if any static variables are mapped to resources
  const varMappings = d.variableMappings ?? {};
  const mappedEntries = Object.entries(varMappings).filter(([, v]) => v?.trim());
  if (mappedEntries.length > 0) {
    lines.push("## Variables");
    lines.push("");
    for (const [varName, ref] of mappedEntries) {
      // Resolve ref to a file path
      let resolvedPath = ref;
      if (ref.startsWith("doc:")) {
        const fileName = ref.slice(4);
        resolvedPath = buildGeneratedDocsFilePath(fileName, target);
      } else if (ref.startsWith("skill:")) {
        const skillName = ref.slice(6);
        resolvedPath = buildGeneratedSkillFilePath(skillName, target);
      }
      lines.push(`- \`${varName}\`: \`${resolvedPath}\``);
    }
    lines.push("");
  }

  if (d.promptText) lines.push(d.promptText);

  // Outgoing Handoff — downstream handoff flowing OUT of this agent.
  if (handoff?.downstream) {
    const { mode, filePath, payloadTemplate, handoffNodeId, otherAgentId } = handoff.downstream;
    const downstreamLabel = otherAgentId ?? "<downstream>";
    if (d.promptText) lines.push("");
    lines.push("## Outgoing Handoff");
    lines.push("");
    if (mode === "file") {
      lines.push(
        `Before finishing, WRITE your handoff payload to \`${filePath}\` so downstream agent \`${downstreamLabel}\` can pick it up (handoff node \`${handoffNodeId}\`).`,
      );
      lines.push("Use this template:");
      lines.push("```");
      lines.push(payloadTemplate);
      lines.push("```");
    } else {
      lines.push(
        `Your final response MUST end with a section titled "Handoff Payload" using this template:`,
      );
      lines.push("```");
      lines.push(payloadTemplate);
      lines.push("```");
      lines.push(
        `The orchestrator will inline this section into downstream agent \`${downstreamLabel}\`'s prompt (handoff node \`${handoffNodeId}\`).`,
      );
    }
  }

  return lines.join("\n");
}

export const generator: NodeGeneratorModule & {
  getAgentFile?(
    nodeId: string,
    data: WorkflowNodeData,
    connectedSkillNames?: string[],
    connectedDocNames?: string[],
    target?: GenerationTargetId,
    handoff?: AgentHandoffContext,
  ): { path: string; content: string } | null;
} = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    return `    ${mermaidId(nodeId)}["Agent: ${mermaidLabel(agentName)}"]`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    const lines = [
      `#### ${nodeId}`,
      "",
      "```",
      `delegate agent: @${agentName}`,
    ];
    // Append parameter mappings if configured
    const mappings = (d.parameterMappings ?? []).map((v) => v.trim()).filter(Boolean);
    if (mappings.length > 0) {
      lines.push(`params: ${mappings.join(", ")}`);
    }
    lines.push("```");
    return lines.join("\n");
  },

  getAgentFile(
    nodeId: string,
    data: WorkflowNodeData,
    connectedSkillNames?: string[],
    connectedDocNames?: string[],
    target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
    handoff?: AgentHandoffContext,
  ) {
    const d = data as SubAgentNodeData;
    const agentName = d.name || `agent-${nodeId}`;
    return {
      path: buildGeneratedAgentFilePath(agentName, target),
      content: buildAgentFile(nodeId, d, connectedSkillNames, connectedDocNames, target, handoff),
    };
  },
};
import { WorkflowNodeType, type NodeType, type WorkflowEdge, type WorkflowNode } from "@/types/workflow";
import { mermaidId } from "@/nodes/shared/mermaid-utils";
import { getDocumentRelativePath } from "@/nodes/document/utils";
import {
  DEFAULT_GENERATION_TARGET,
  getGenerationTarget,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import { NODE_GENERATORS, resolveSkillReferenceName, topologicalOrder } from "./shared";

function collectSections(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  predicate: (node: WorkflowNode) => boolean,
  getDetail: (node: WorkflowNode) => string,
): string[] {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((node) => [node.id, node]));
  const sections: string[] = [];

  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || !predicate(node)) continue;

    const detail = getDetail(node);
    if (detail) sections.push(detail);
  }

  return sections;
}

function buildSectionBlock(
  heading: string,
  sections: string[],
  intro?: string,
): string {
  if (sections.length === 0) return "";

  const parts = [heading, ""];
  if (intro) {
    parts.push(intro, "");
  }
  parts.push(sections.join("\n\n"));

  return parts.join("\n");
}

function buildGeneratedNodeSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeType: WorkflowNode["data"]["type"],
  heading: string,
  intro?: string,
): string {
  const generator = NODE_GENERATORS[nodeType];
  if (!generator) return "";

  const sections = collectSections(
    nodes,
    edges,
    (node) => node.data.type === nodeType,
    (node) => generator.getDetailsSection(node.id, node.data),
  );

  return buildSectionBlock(heading, sections, intro);
}

export function buildPromptDetailsSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string {
  return buildGeneratedNodeSection(nodes, edges, WorkflowNodeType.Prompt, "### Prompt Node Details");
}

export function buildSubAgentDetailsSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
): string {
  const order = topologicalOrder(nodes, edges);
  const allNodeById = new Map<string, WorkflowNode>(allNodes.map((node) => [node.id, node]));
  const skillEdgesByTarget = new Map<string, string[]>();

  for (const edge of allEdges) {
    if (edge.sourceHandle !== "skill-out") continue;

    if (!skillEdgesByTarget.has(edge.target)) {
      skillEdgesByTarget.set(edge.target, []);
    }
    skillEdgesByTarget.get(edge.target)?.push(edge.source);
  }

  const topoIndex = new Map<string, number>(order.map((id, index) => [id, index]));
  for (const [targetId, sourceIds] of skillEdgesByTarget) {
    skillEdgesByTarget.set(
      targetId,
      sourceIds.sort((a, b) => (topoIndex.get(a) ?? 0) - (topoIndex.get(b) ?? 0)),
    );
  }

  const sections: string[] = [];
  for (const id of order) {
    const node = allNodeById.get(id);
    if (!node || node.data.type !== WorkflowNodeType.Agent) continue;

    const d = node.data as import("@/nodes/agent/types").SubAgentNodeData;
    const agentName = d.name || `agent-${node.id}`;
    const lines: string[] = [
      `#### ${node.id}(Agent: ${agentName})`,
      "",
      "```",
      `delegate agent: @${agentName}`,
    ];

    const mappings = (d.parameterMappings ?? [])
      .map((value) => value.trim())
      .filter(Boolean);
    if (mappings.length > 0) {
      lines.push(`params: ${mappings.join(", ")}`);
    }

    const skillIds = skillEdgesByTarget.get(node.id) ?? [];
    for (const skillId of skillIds) {
      const skillNode = allNodeById.get(skillId);
      if (skillNode?.data.type !== WorkflowNodeType.Skill) continue;

      const skillData = skillNode.data as import("@/nodes/skill/types").SkillNodeData;
      const skillName = skillData.skillName?.trim() || skillData.name?.trim() || skillId;
      lines.push(`skill: ${skillName}`);
    }

    lines.push("```");
    sections.push(lines.join("\n"));
  }

  return buildSectionBlock("## Agent Node Details", sections);
}

export function buildIfElseDetailsSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string {
  return buildGeneratedNodeSection(nodes, edges, WorkflowNodeType.IfElse, "### If/Else Node Details");
}

export function buildSwitchDetailsSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string {
  return buildGeneratedNodeSection(nodes, edges, WorkflowNodeType.Switch, "### Switch Node Details");
}

function getDocDisplayLabel(relativePath: string): string {
  const lastSlash = relativePath.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? relativePath.slice(lastSlash + 1) : relativePath;
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

export function buildParallelAgentDetailsSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((node) => [node.id, node]));
  const sections: string[] = [];
  const rootDir = getGenerationTarget(target).rootDir;

  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || node.data.type !== WorkflowNodeType.ParallelAgent) continue;

    const d = node.data as import("@/types/workflow").ParallelAgentNodeData;
    const mode: import("@/types/workflow").ParallelAgentSpawnMode = d.spawnMode ?? "fixed";

    if (mode === "fixed") {
      const lines: string[] = [`#### ${mermaidId(node.id)}(Parallel Agent)`, ""];

      if (d.sharedInstructions?.trim()) {
        lines.push(`**Shared instructions**: ${d.sharedInstructions.trim()}`, "");
      }

      lines.push("**Parallel branches:**");
      for (let index = 0; index < (d.branches ?? []).length; index += 1) {
        const branch = d.branches[index];
        const edge = edges.find(
          (candidate) =>
            candidate.source === node.id &&
            candidate.sourceHandle === `branch-${index}`,
        );
        const targetNode = edge ? nodeById.get(edge.target) : null;
        const targetLabel = targetNode?.id || "Unconnected";
        const spawnCount = Math.max(1, Number(branch.spawnCount ?? 1));
        lines.push(
          `- **branch-${index}** (${branch.label || `Branch ${index + 1}`}) → spawn **${targetLabel}** x${spawnCount}`,
        );
        if (branch.instructions?.trim()) {
          lines.push(`  - Notes: ${branch.instructions.trim()}`);
        }
      }

      lines.push(
        "",
        "**Execution method**: Spawn the connected downstream agent for each branch handle in parallel using the configured branch counts.",
      );
      sections.push(lines.join("\n"));
      continue;
    }

    // Dynamic mode — dispatch-style output
    const spawnMin = Math.max(1, Number(d.spawnMin ?? 1));
    const spawnMax = Math.max(spawnMin, Number(d.spawnMax ?? spawnMin));
    const criterion = d.spawnCriterion?.trim() || "<criterion>";
    const rangePhrase = spawnMin === spawnMax
      ? `exactly ${spawnMin} times`
      : `between ${spawnMin} and ${spawnMax} times`;

    const outgoingEdge = edges.find(
      (candidate) =>
        candidate.source === node.id &&
        nodeById.get(candidate.target)?.data.type === WorkflowNodeType.Agent,
    );
    const templateTarget = outgoingEdge ? nodeById.get(outgoingEdge.target) : null;
    const templateId = templateTarget?.id ?? "<agent-not-connected>";
    const templateConnected = templateTarget !== null && templateTarget !== undefined;

    const lines: string[] = [`#### ${mermaidId(node.id)}`, ""];

    if (!templateConnected) {
      lines.push(
        "<!-- WARNING: no template agent connected to this parallel-agent node -->",
        "",
      );
    }

    if (d.sharedInstructions?.trim()) {
      lines.push(`**Shared instructions**: ${d.sharedInstructions.trim()}`, "");
    }

    lines.push(
      `Spawn \`${templateId}\` ${rangePhrase} based on: ${criterion}. For each spawned instance, dispatch it as follows:`,
      "",
      `#### ${templateId} (Agent: ${templateId})`,
      "",
    );

    // Collect inputs from the template agent's connected skills and documents
    const inputs: string[] = [];
    if (templateConnected && templateTarget) {
      const templateNodeId = templateTarget.id;
      // Walk edges in their natural order to preserve edge-walk ordering
      const skillEdges = edges.filter(
        (edge) =>
          edge.sourceHandle === "skill-out" &&
          edge.target === templateNodeId,
      );
      for (const edge of skillEdges) {
        const skillNode = nodeById.get(edge.source);
        if (skillNode?.data.type !== WorkflowNodeType.Skill) continue;
        const skillData = skillNode.data as import("@/nodes/skill/types").SkillNodeData;
        const skillName = resolveSkillReferenceName(skillData);
        if (!skillName) continue;
        inputs.push(`- \`${skillName}\`: \`${rootDir}/skills/${skillName}/SKILL.md\``);
      }

      const docEdges = edges.filter(
        (edge) =>
          edge.sourceHandle === "doc-out" &&
          edge.target === templateNodeId,
      );
      for (const edge of docEdges) {
        const docNode = nodeById.get(edge.source);
        if (docNode?.data.type !== WorkflowNodeType.Document) continue;
        const docData = docNode.data as import("@/nodes/document/types").DocumentNodeData;
        const relativePath = getDocumentRelativePath(docData);
        if (!relativePath) continue;
        const displayLabel = getDocDisplayLabel(relativePath);
        inputs.push(`- \`${displayLabel}\`: \`${rootDir}/docs/${relativePath}\``);
      }
    }

    if (inputs.length === 0) {
      lines.push(`Dispatch \`${templateId}\` using the \`Agent\` tool.`);
    } else {
      lines.push(`Dispatch \`${templateId}\` using the \`Agent\` tool with inputs:`);
      lines.push(...inputs);
    }

    sections.push(lines.join("\n"));
  }

  return buildSectionBlock("### Parallel Agent Node Details", sections);
}

export function buildAskUserDetailsSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string {
  return buildGeneratedNodeSection(
    nodes,
    edges,
    WorkflowNodeType.AskUser,
    "### AskUserQuestion Node Details",
    "Ask the user using question or AskUserQuestion tools and proceed based on their choice.",
  );
}

export function buildSubWorkflowDetailsSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string {
  return buildGeneratedNodeSection(
    nodes,
    edges,
    WorkflowNodeType.SubWorkflow,
    "### Sub-Workflow Node Details",
  );
}

export function buildDetailsSection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string {
  const skipTypes = new Set<NodeType>([
    WorkflowNodeType.Start,
    WorkflowNodeType.End,
    WorkflowNodeType.Prompt,
    WorkflowNodeType.Agent,
    WorkflowNodeType.ParallelAgent,
    WorkflowNodeType.Skill,
    WorkflowNodeType.Document,
    WorkflowNodeType.IfElse,
    WorkflowNodeType.Switch,
    WorkflowNodeType.AskUser,
    WorkflowNodeType.SubWorkflow,
  ]);

  const sections = collectSections(
    nodes,
    edges,
    (node) => !skipTypes.has(node.data.type),
    (node) => NODE_GENERATORS[node.data.type]?.getDetailsSection(node.id, node.data) ?? "",
  );

  return buildSectionBlock("## Node Details", sections);
}


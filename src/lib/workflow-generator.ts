/**
 * workflow-generator.ts
 *
 * Converts a WorkflowJSON into one or more file artifacts for the "Generate"
 * feature. Orchestrates per-node generator modules; all node-specific logic
 * lives in src/nodes/<type>/generator.ts.
 */
import type { WorkflowJSON, WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { generator as startGen }        from "@/nodes/start/generator";
import { generator as endGen }          from "@/nodes/end/generator";
import { generator as promptGen }       from "@/nodes/prompt/generator";
import { generator as scriptGen }       from "@/nodes/script/generator";
import { generator as subAgentGen }     from "@/nodes/agent/generator";
import { generator as parallelAgentGen } from "@/nodes/parallel-agent/generator";
import { generator as subWorkflowGen } from "@/nodes/sub-workflow/generator";
import { generator as skillGen }        from "@/nodes/skill/generator";
import { generator as documentGen }     from "@/nodes/document/generator";
import { generator as mcpToolGen }      from "@/nodes/mcp-tool/generator";
import { generator as ifElseGen }       from "@/nodes/if-else/generator";
import { generator as switchGen }       from "@/nodes/switch/generator";
import { generator as askUserGen }      from "@/nodes/ask-user/generator";
import type { NodeGeneratorModule }     from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel }      from "@/nodes/shared/mermaid-utils";
import { getDocumentRelativePath } from "@/nodes/document/utils";
import {
  buildGeneratedCommandFilePath,
  buildGeneratedSkillScriptFilePath,
  DEFAULT_GENERATION_TARGET,
  sanitizeGeneratedName,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import { getSkillScriptBaseName, getSkillScriptFileName } from "@/nodes/skill/script-utils";
import { generateRunScriptFiles } from "@/lib/run-script-generator";
export interface GeneratedFile {
  path: string;
  content: string;
}
const NODE_GENERATORS: Record<string, NodeGeneratorModule> = {
  start:            startGen,
  end:              endGen,
  prompt:           promptGen,
  script:           scriptGen,
  "agent":          subAgentGen,
  "parallel-agent": parallelAgentGen,
  "sub-workflow":   subWorkflowGen,
  skill:            skillGen,
  document:         documentGen,
  "mcp-tool":       mcpToolGen,
  "if-else":        ifElseGen,
  switch:           switchGen,
  "ask-user":       askUserGen,
};

const SKILL_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function resolveSkillReferenceName(d: { skillName?: string; label?: string; name?: string }): string | null {
  const candidates = [d.skillName, d.label, d.name];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && SKILL_SLUG_REGEX.test(trimmed)) return trimmed;
  }
  return null;
}

function mermaidNodeShape(node: WorkflowNode): string {
  if (node.data.type === "skill") return "";
  if (node.data.type === "document") return "";
  if (node.data.type === "script") return "";
  const gen = NODE_GENERATORS[node.data.type];
  if (gen) return gen.getMermaidShape(node.id, node.data);
  return `    ${mermaidId(node.id)}["${mermaidLabel(node.data.label ?? node.data.type)}"]`;
}
function mermaidEdge(edge: WorkflowEdge, nodeById?: Map<string, WorkflowNode>): string {
  const srcId = mermaidId(edge.source);
  const tgtId = mermaidId(edge.target);
  const defaultHandles = new Set(["output", "input"]);
  const showLabel = edge.sourceHandle && !defaultHandles.has(edge.sourceHandle);
  if (showLabel) {
    let raw = edge.sourceHandle!;
    // Only capitalize simple boolean handles (true/false); keep everything else as-is
    const boolHandles = new Set(["true", "false"]);
    // Resolve ask-user option-N handles to their label text
    const optionMatch = raw.match(/^option-(\d+)$/);
    if (optionMatch && nodeById) {
      const srcNode = nodeById.get(edge.source);
      if (srcNode?.data?.type === "ask-user") {
        const d = srcNode.data as import("@/types/workflow").AskUserNodeData;
        const idx = parseInt(optionMatch[1], 10);
        const opt = d.options?.[idx];
        if (opt && typeof opt === "object" && opt.label) {
          raw = opt.label;
        }
      }
    }
    const parallelMatch = raw.match(/^branch-(\d+)$/);
    if (parallelMatch && nodeById) {
      const srcNode = nodeById.get(edge.source);
      if (srcNode?.data?.type === "parallel-agent") {
        const d = srcNode.data as import("@/types/workflow").ParallelAgentNodeData;
        const idx = parseInt(parallelMatch[1], 10);
        const branch = d.branches?.[idx];
        if (branch?.label) {
          raw = branch.label;
        }
      }
    }
    const displayLabel = boolHandles.has(raw)
      ? raw.charAt(0).toUpperCase() + raw.slice(1)
      : raw;
    return `    ${srcId} -->|${mermaidLabel(displayLabel)}| ${tgtId}`;
  }
  return `    ${srcId} --> ${tgtId}`;
}
function filterReachable(nodes: WorkflowNode[], edges: WorkflowEdge[]): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const adjMap = new Map<string, string[]>();
  for (const node of nodes) adjMap.set(node.id, []);
  for (const edge of edges) adjMap.get(edge.source)?.push(edge.target);
  const visited = new Set<string>();
  const queue: string[] = nodes.filter((n) => n.data.type === "start").map((n) => n.id);
  for (const id of queue) visited.add(id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of adjMap.get(id) ?? []) {
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  return {
    nodes: nodes.filter((n) => visited.has(n.id)),
    edges: edges.filter((e) => visited.has(e.source) && visited.has(e.target)),
  };
}
function topologicalOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const adjMap = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of nodes) { adjMap.set(node.id, []); inDegree.set(node.id, 0); }
  for (const edge of edges) {
    adjMap.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const node of nodes) if ((inDegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of (adjMap.get(id) ?? [])) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  return order;
}
function buildPromptDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const sections: string[] = [];
  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || node.data.type !== "prompt") continue;
    sections.push(promptGen.getDetailsSection(node.id, node.data));
  }
  if (sections.length === 0) return "";
  return "### Prompt Node Details\n\n" + sections.join("\n\n");
}
function buildSubAgentDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[], allNodes: WorkflowNode[], allEdges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const allNodeById = new Map<string, WorkflowNode>(allNodes.map((n) => [n.id, n]));

  // Build a map of agent id → skill nodes connected to it (skill-out edges).
  // Scan ALL edges because skill nodes sit outside the main flow graph.
  const skillEdgesByTarget = new Map<string, string[]>();
  for (const edge of allEdges) {
    if (edge.sourceHandle === "skill-out") {
      if (!skillEdgesByTarget.has(edge.target)) skillEdgesByTarget.set(edge.target, []);
      skillEdgesByTarget.get(edge.target)!.push(edge.source);
    }
  }

  // Sort skill nodes per agent by topological order
  const topoIndex = new Map<string, number>(order.map((id, i) => [id, i]));
  for (const [tgt, srcs] of skillEdgesByTarget) {
    skillEdgesByTarget.set(tgt, srcs.sort((a, b) => (topoIndex.get(a) ?? 0) - (topoIndex.get(b) ?? 0)));
  }

  const sections: string[] = [];
  for (const id of order) {
    const node = allNodeById.get(id);
    if (!node || node.data.type !== "agent") continue;

    const d = node.data as import("@/nodes/agent/types").SubAgentNodeData;
    const agentName = d.name || `agent-${node.id}`;

    const lines: string[] = [
      `#### ${node.id}(Agent: ${agentName})`,
      "",
      "```",
      `delegate agent: @${agentName}`,
    ];

    // Append parameter mappings if configured
    const mappings = (d.parameterMappings ?? []).map((v) => v.trim()).filter(Boolean);
    if (mappings.length > 0) {
      lines.push(`params: ${mappings.join(", ")}`);
    }

    // Append skills connected to this agent
    const skillIds = skillEdgesByTarget.get(node.id) ?? [];
    for (const skillId of skillIds) {
      const skillNode = allNodeById.get(skillId);
      if (skillNode && skillNode.data.type === "skill") {
        const sd = skillNode.data as import("@/nodes/skill/types").SkillNodeData;
        const skillName = sd.skillName?.trim() || sd.name?.trim() || skillId;
        lines.push(`skill: ${skillName}`);
      }
    }


    lines.push("```");
    sections.push(lines.join("\n"));
  }

  if (sections.length === 0) return "";
  return "## Agent Node Details\n\n" + sections.join("\n\n");
}
function buildIfElseDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const sections: string[] = [];
  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || node.data.type !== "if-else") continue;
    const gen = NODE_GENERATORS["if-else"];
    if (gen) {
      const detail = gen.getDetailsSection(node.id, node.data);
      if (detail) sections.push(detail);
    }
  }
  if (sections.length === 0) return "";
  return "### If/Else Node Details\n\n" + sections.join("\n\n");
}
function buildSwitchDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const sections: string[] = [];
  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || node.data.type !== "switch") continue;
    const gen = NODE_GENERATORS["switch"];
    if (gen) {
      const detail = gen.getDetailsSection(node.id, node.data);
      if (detail) sections.push(detail);
    }
  }
  if (sections.length === 0) return "";
  return "### Switch Node Details\n\n" + sections.join("\n\n");
}
function buildParallelAgentDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const sections: string[] = [];
  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || node.data.type !== "parallel-agent") continue;
    const d = node.data as import("@/types/workflow").ParallelAgentNodeData;
    const lines: string[] = [`#### ${mermaidId(node.id)}(Parallel Agent)`, ""];

    if (d.sharedInstructions?.trim()) {
      lines.push(`**Shared instructions**: ${d.sharedInstructions.trim()}`);
      lines.push("");
    }

    lines.push("**Parallel branches:**");
    for (let index = 0; index < (d.branches ?? []).length; index++) {
      const branch = d.branches[index];
      const edge = edges.find((e) => e.source === node.id && e.sourceHandle === `branch-${index}`);
      const targetNode = edge ? nodeById.get(edge.target) : null;
      const targetLabel = targetNode?.id || "Unconnected";
      const spawnCount = Math.max(1, Number(branch.spawnCount ?? 1));
      lines.push(`- **branch-${index}** (${branch.label || `Branch ${index + 1}`}) → spawn **${targetLabel}** x${spawnCount}`);
      if (branch.instructions?.trim()) {
        lines.push(`  - Notes: ${branch.instructions.trim()}`);
      }
    }

    lines.push("");
    lines.push("**Execution method**: Spawn the connected downstream agent for each branch handle in parallel using the configured branch counts.");
    sections.push(lines.join("\n"));
  }
  if (sections.length === 0) return "";
  return "### Parallel Agent Node Details\n\n" + sections.join("\n\n");
}
function buildAskUserDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const sections: string[] = [];
  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || node.data.type !== "ask-user") continue;
    const gen = NODE_GENERATORS["ask-user"];
    if (gen) {
      const detail = gen.getDetailsSection(node.id, node.data);
      if (detail) sections.push(detail);
    }
  }
  if (sections.length === 0) return "";
  return "### AskUserQuestion Node Details\n\nAsk the user using question or AskUserQuestion tools and proceed based on their choice.\n\n" + sections.join("\n\n");
}
function buildSubWorkflowDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const sections: string[] = [];
  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || node.data.type !== "sub-workflow") continue;

    const gen = NODE_GENERATORS["sub-workflow"];
    if (gen) {
      const detail = gen.getDetailsSection(node.id, node.data);
      if (detail) sections.push(detail);
    }
  }
  if (sections.length === 0) return "";
  return "### Sub-Workflow Node Details\n\n" + sections.join("\n\n");
}
function buildDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const sections: string[] = [];
  const SKIP = new Set(["start", "end", "prompt", "agent", "parallel-agent", "skill", "document", "if-else", "switch", "ask-user", "sub-workflow"]);
  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || SKIP.has(node.data.type)) continue;
    const gen = NODE_GENERATORS[node.data.type];
    if (gen) {
      const detail = gen.getDetailsSection(node.id, node.data);
      if (detail) sections.push(detail);
    }
  }
  if (sections.length === 0) return "";
  return ["## Node Details", "", ...sections].join("\n\n");
}
function collectAgentFiles(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  target: GenerationTargetId,
): GeneratedFile[] {
  const { nodes: reachable } = filterReachable(nodes, edges);
  const reachableIds = new Set(reachable.map((n) => n.id));
  const allNodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  // Build maps from reachable agent-like nodes to connected skill/document IDs.
  const skillsByTarget = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.sourceHandle === "skill-out" && reachableIds.has(edge.target)) {
      const targetNode = allNodeById.get(edge.target);
      const sourceNode = allNodeById.get(edge.source);
      if ((targetNode?.data?.type === "agent" || targetNode?.data?.type === "parallel-agent") && sourceNode?.data?.type === "skill") {
        if (!skillsByTarget.has(edge.target)) skillsByTarget.set(edge.target, []);
        skillsByTarget.get(edge.target)!.push(edge.source);
      }
    }
  }

  const docsByTarget = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.sourceHandle === "doc-out" && reachableIds.has(edge.target)) {
      const targetNode = allNodeById.get(edge.target);
      const sourceNode = allNodeById.get(edge.source);
      if ((targetNode?.data?.type === "agent" || targetNode?.data?.type === "parallel-agent") && sourceNode?.data?.type === "document") {
        if (!docsByTarget.has(edge.target)) docsByTarget.set(edge.target, []);
        docsByTarget.get(edge.target)!.push(edge.source);
      }
    }
  }

  const scriptsBySkill = new Map<string, string[]>();
  for (const edge of edges) {
    const targetNode = allNodeById.get(edge.target);
    const sourceNode = allNodeById.get(edge.source);
    if (edge.targetHandle === "scripts" && targetNode?.data?.type === "skill" && sourceNode?.data?.type === "script") {
      if (!scriptsBySkill.has(edge.target)) scriptsBySkill.set(edge.target, []);
      scriptsBySkill.get(edge.target)!.push(edge.source);
    }
  }

  // Track which skill nodes are actually connected to a reachable agent
  const connectedSkillIds = new Set<string>();
  for (const skillIds of skillsByTarget.values()) {
    for (const id of skillIds) connectedSkillIds.add(id);
  }

  // Track which document nodes are actually connected to a reachable agent
  const connectedDocIds = new Set<string>();
  for (const docIds of docsByTarget.values()) {
    for (const id of docIds) connectedDocIds.add(id);
  }

  const files: GeneratedFile[] = [];

  // Generate agent files with their connected skill names
  for (const node of reachable) {
    if (node.data.type === "agent") {
      const skillIds = skillsByTarget.get(node.id) ?? [];
      const connectedSkillNames: string[] = [];
      for (const skillId of skillIds) {
        const skillNode = allNodeById.get(skillId);
        if (skillNode?.data?.type === "skill") {
          const sd = skillNode.data as import("@/nodes/skill/types").SkillNodeData;
          const skillName = resolveSkillReferenceName(sd);
          if (skillName) connectedSkillNames.push(skillName);
        }
      }

      const docIds = docsByTarget.get(node.id) ?? [];
      const connectedDocNames: string[] = [];
      for (const docId of docIds) {
        const docNode = allNodeById.get(docId);
        if (docNode?.data?.type === "document") {
          const dd = docNode.data as import("@/nodes/document/types").DocumentNodeData;
          const relativePath = getDocumentRelativePath(dd);
          if (relativePath) connectedDocNames.push(relativePath);
        }
      }

      const gen = NODE_GENERATORS[node.data.type];
      if (gen?.getAgentFile) {
        const f = gen.getAgentFile(node.id, node.data, connectedSkillNames, connectedDocNames, target);
        if (f) files.push(f);
      }
    }
  }

  // Generate skill files only for skills connected to a reachable agent
  for (const skillId of connectedSkillIds) {
    const skillNode = allNodeById.get(skillId);
    if (skillNode?.data?.type === "skill") {
      const gen = NODE_GENERATORS["skill"];
      const skillData = skillNode.data as import("@/nodes/skill/types").SkillNodeData;
      const skillName = resolveSkillReferenceName(skillData);
      const connectedScripts = (scriptsBySkill.get(skillId) ?? [])
        .map((scriptId) => allNodeById.get(scriptId))
        .filter((node): node is WorkflowNode => !!node && node.data.type === "script")
        .map((node) => ({
          label: (node.data.label as string) || node.id,
          fileName: getSkillScriptFileName(node.data),
          variableName: getSkillScriptBaseName(node.data),
          content: (node.data.promptText as string) || "",
        }));
      if (gen?.getSkillFile) {
        const f = gen.getSkillFile(skillNode.id, skillNode.data, connectedScripts, target);
        if (f) files.push(f);
      }
      if (skillName) {
        for (const script of connectedScripts) {
          files.push({
            path: buildGeneratedSkillScriptFilePath(skillName, script.fileName, target),
            content: script.content.endsWith("\n") ? script.content : `${script.content}\n`,
          });
        }
      }
    }
  }

  // Generate document files only for documents connected to a reachable agent
  for (const docId of connectedDocIds) {
    const docNode = allNodeById.get(docId);
    if (docNode?.data?.type === "document") {
      const gen = NODE_GENERATORS["document"];
      if (gen?.getDocFile) {
        const f = gen.getDocFile(docNode.id, docNode.data, target);
        if (f) files.push(f);
      }
    }
  }

  // Generate sub-workflow files (inner command file + agent file if agent mode)
  for (const node of reachable) {
    if (node.data.type === "sub-workflow") {
      const gen = NODE_GENERATORS["sub-workflow"] as NodeGeneratorModule & {
        getSubWorkflowJSON?(id: string, d: WorkflowNode["data"]): WorkflowJSON | null;
      };
      const d = node.data as import("@/nodes/sub-workflow/types").SubWorkflowNodeData;

      if (d.mode === "agent") {
        // Agent mode: generate inner workflow command file using label-based slug + agent file
        if (gen?.getSubWorkflowJSON) {
          const innerJSON = gen.getSubWorkflowJSON(node.id, node.data);
          if (innerJSON) {
            const innerFiles = generateWorkflowFiles(innerJSON, target);
            files.push(...innerFiles);
          }
        }
        if (gen?.getAgentFile) {
          const f = gen.getAgentFile(node.id, node.data, undefined, undefined, target);
          if (f) files.push(f);
        }
      } else {
        // Same-context mode: generate command file named by mermaid node ID
        if (gen?.getSubWorkflowJSON) {
          const innerJSON = gen.getSubWorkflowJSON(node.id, node.data);
          if (innerJSON) {
            const mid = mermaidId(node.id);
            const commandFile: GeneratedFile = {
              path: buildGeneratedCommandFilePath(mid, target),
              content: buildCommandMarkdown(innerJSON),
            };
            files.push(commandFile);
            // Recursively collect nested agent/skill/sub-workflow files
            const innerAgentFiles = collectAgentFiles(innerJSON.nodes, innerJSON.edges, target);
            files.push(...innerAgentFiles);
          }
        }
      }
    }
  }

  return files;
}
function buildCommandMarkdown(workflow: WorkflowJSON): string {
  const { name } = workflow;
  const { nodes, edges } = filterReachable(workflow.nodes, workflow.edges);
  const seenTypes = new Set<string>();
  const endNodeIdMap = new Map<string, string>();
  let canonicalEndId: string | null = null;
  const dedupedNodes = nodes.filter((n) => {
    if (n.data.type === "skill") return false; // skills excluded from workflow.md
    if (n.data.type === "document") return false; // documents excluded from workflow.md
    if (n.data.type === "script") return false; // scripts excluded from workflow.md
    if (n.data.type === "start" || n.data.type === "end") {
      if (!seenTypes.has(n.data.type)) {
        seenTypes.add(n.data.type);
        if (n.data.type === "end") canonicalEndId = n.id;
        return true;
      }
      if (n.data.type === "end" && canonicalEndId) endNodeIdMap.set(n.id, canonicalEndId);
      return false;
    }
    return true;
  });

  // Build set of attachment node IDs so we can exclude their edges
  const skillNodeIds = new Set(nodes.filter((n) => n.data.type === "skill").map((n) => n.id));
  const documentNodeIds = new Set(nodes.filter((n) => n.data.type === "document").map((n) => n.id));
  const scriptNodeIds = new Set(nodes.filter((n) => n.data.type === "script").map((n) => n.id));

  const remappedEdges = edges
    .filter((e) => !skillNodeIds.has(e.source) && !skillNodeIds.has(e.target)
                 && !documentNodeIds.has(e.source) && !documentNodeIds.has(e.target)
                 && !scriptNodeIds.has(e.source) && !scriptNodeIds.has(e.target))
    .map((e) => {
      const remappedTarget = endNodeIdMap.get(e.target);
      const remappedSource = endNodeIdMap.get(e.source);
      if (remappedTarget || remappedSource) {
        return { ...e, target: remappedTarget ?? e.target, source: remappedSource ?? e.source };
      }
      return e;
    });

  // Sort edges so that start-node edges come first, then follow topological order
  const topoOrder = topologicalOrder(dedupedNodes, remappedEdges);
  const topoIdx = new Map<string, number>(topoOrder.map((id, i) => [id, i]));
  const sortedEdges = [...remappedEdges].sort((a, b) => {
    const ai = topoIdx.get(a.source) ?? Infinity;
    const bi = topoIdx.get(b.source) ?? Infinity;
    if (ai !== bi) return ai - bi;
    // Same source: sort by target topological order
    const ati = topoIdx.get(a.target) ?? Infinity;
    const bti = topoIdx.get(b.target) ?? Infinity;
    return ati - bti;
  });

  const nodeLines = dedupedNodes.map(mermaidNodeShape).filter(Boolean);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const edgeLines = sortedEdges.map((e) => mermaidEdge(e, nodeById));
  const mermaidInner = edgeLines.length > 0 ? [...nodeLines, "", ...edgeLines] : nodeLines;
  const mermaidBlock = ["```mermaid", "flowchart TD", ...mermaidInner, "```"].join("\n");
  const startNodeId = nodes.find((n) => n.data.type === "start")?.id ?? "start";
  const executionGuide = `## Workflow Execution Guide
Follow the Mermaid flowchart above to execute the workflow starting from \`${mermaidId(startNodeId)}\` node. Each node type has specific execution methods as described below.
Split each flow path into a todo item using todowrite and todoread tools, and update the todo list correspondingly.

### Positional Arguments
Workflow arguments are **comma-separated and trimmed**. For example \`/workflow 2, 5, 10\` yields \`$1=2\`, \`$2=5\`, \`$3=10\`.

### Execution Methods by Node Type
- **Stadium nodes (Start / End)**: Entry and exit points of the workflow
- **Rectangle nodes (Agent: ...)**: Execute Agents via the spawn agent delegation system. If a \`params:\` line is present, pass those values as the agent's positional arguments (\`$1\`, \`$2\`, …). Values can be workflow-level positional args (e.g. \`$1\`), static references (e.g. \`{{name}}\`), or literal strings
- **Rectangle nodes (Parallel Agent: ...)**: For each branch handle, spawn the connected downstream agent the configured number of times and follow each branch independently
- **Diamond nodes (AskUserQuestion:...)**: Use the AskUserQuestion tool to prompt the user and branch based on their response
- **Diamond nodes (Branch/Switch:...)**: Automatically branch based on the results of previous processing (see details section)
- **Rectangle nodes (Prompt nodes)**: Execute the prompts described in the details section below`;
  const promptDetails    = buildPromptDetailsSection(nodes, edges);
  const subAgentDetails  = buildSubAgentDetailsSection(nodes, edges, workflow.nodes, workflow.edges);
  const parallelAgentDetails = buildParallelAgentDetailsSection(nodes, edges);
  const ifElseDetails    = buildIfElseDetailsSection(nodes, edges);
  const switchDetails    = buildSwitchDetailsSection(nodes, edges);
  const askUserDetails   = buildAskUserDetailsSection(nodes, edges);
  const subWorkflowDetails = buildSubWorkflowDetailsSection(nodes, edges);
  const otherDetails     = buildDetailsSection(nodes, edges);

  // Build frontmatter
  const frontmatter = `---\ndescription: ${name}\n---`;

  const parts = [frontmatter, mermaidBlock, "", executionGuide];
  if (promptDetails)   parts.push("", promptDetails);
  if (subAgentDetails) parts.push("", subAgentDetails);
  if (parallelAgentDetails) parts.push("", parallelAgentDetails);
  if (subWorkflowDetails) parts.push("", subWorkflowDetails);
  if (ifElseDetails)   parts.push("", ifElseDetails);
  if (switchDetails)   parts.push("", switchDetails);
  if (askUserDetails)  parts.push("", askUserDetails);
  if (otherDetails)    parts.push("", otherDetails);
  return parts.join("\n") + "\n";
}
export function generateWorkflowFiles(
  workflow: WorkflowJSON,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): GeneratedFile[] {
  const safeName = sanitizeGeneratedName(workflow.name);
  const commandFile: GeneratedFile = {
    path: buildGeneratedCommandFilePath(safeName, target),
    content: buildCommandMarkdown(workflow),
  };
  const agentFiles = collectAgentFiles(workflow.nodes, workflow.edges, target);
  const runScripts = generateRunScriptFiles(safeName, target);
  return [commandFile, ...agentFiles, ...runScripts];
}
export function getCommandMarkdown(workflow: WorkflowJSON): string {
  return buildCommandMarkdown(workflow);
}
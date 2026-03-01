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
import { generator as subAgentGen }     from "@/nodes/sub-agent/generator";
import { generator as subAgentFlowGen } from "@/nodes/sub-agent-flow/generator";
import { generator as skillGen }        from "@/nodes/skill/generator";
import { generator as mcpToolGen }      from "@/nodes/mcp-tool/generator";
import { generator as ifElseGen }       from "@/nodes/if-else/generator";
import { generator as switchGen }       from "@/nodes/switch/generator";
import { generator as askUserGen }      from "@/nodes/ask-user/generator";
import type { NodeGeneratorModule }     from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel }      from "@/nodes/shared/mermaid-utils";
export interface GeneratedFile {
  path: string;
  content: string;
}
const NODE_GENERATORS: Record<string, NodeGeneratorModule> = {
  start:            startGen,
  end:              endGen,
  prompt:           promptGen,
  "agent":          subAgentGen,
  "sub-workflow":   subAgentFlowGen,
  skill:            skillGen,
  "mcp-tool":       mcpToolGen,
  "if-else":        ifElseGen,
  switch:           switchGen,
  "ask-user":       askUserGen,
};
function mermaidNodeShape(node: WorkflowNode): string {
  if (node.data.type === "skill") return "";
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

    const d = node.data as import("@/nodes/sub-agent/types").SubAgentNodeData;
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
  const SKIP = new Set(["start", "end", "prompt", "agent", "skill", "if-else", "switch", "ask-user", "sub-workflow"]);
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
function collectAgentFiles(nodes: WorkflowNode[], edges: WorkflowEdge[]): GeneratedFile[] {
  const { nodes: reachable } = filterReachable(nodes, edges);
  const reachableIds = new Set(reachable.map((n) => n.id));
  const allNodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  // Build a map: reachable agent id → skill node ids connected via skill-out
  // edges. We scan ALL edges (not just reachable ones) because skill nodes sit
  // outside the main flow and are never forward-reachable from the start node.
  const skillsBySubAgent = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.sourceHandle === "skill-out" && reachableIds.has(edge.target)) {
      const targetNode = allNodeById.get(edge.target);
      const sourceNode = allNodeById.get(edge.source);
      if (targetNode?.data?.type === "agent" && sourceNode?.data?.type === "skill") {
        if (!skillsBySubAgent.has(edge.target)) skillsBySubAgent.set(edge.target, []);
        skillsBySubAgent.get(edge.target)!.push(edge.source);
      }
    }
  }

  // Track which skill nodes are actually connected to a reachable agent
  const connectedSkillIds = new Set<string>();
  for (const skillIds of skillsBySubAgent.values()) {
    for (const id of skillIds) connectedSkillIds.add(id);
  }

  const files: GeneratedFile[] = [];

  // Generate agent files with their connected skill names
  for (const node of reachable) {
    if (node.data.type === "agent") {
      const skillIds = skillsBySubAgent.get(node.id) ?? [];
      const connectedSkillNames: string[] = [];
      for (const skillId of skillIds) {
        const skillNode = allNodeById.get(skillId);
        if (skillNode?.data?.type === "skill") {
          const sd = skillNode.data as import("@/nodes/skill/types").SkillNodeData;
          const skillName = sd.skillName?.trim() || sd.name?.trim();
          if (skillName) connectedSkillNames.push(skillName);
        }
      }

      const gen = NODE_GENERATORS["agent"];
      if (gen?.getAgentFile) {
        const f = gen.getAgentFile(node.id, node.data, connectedSkillNames);
        if (f) files.push(f);
      }
    }
  }

  // Generate skill files only for skills connected to a reachable agent
  for (const skillId of connectedSkillIds) {
    const skillNode = allNodeById.get(skillId);
    if (skillNode?.data?.type === "skill") {
      const gen = NODE_GENERATORS["skill"] as typeof NODE_GENERATORS["skill"] & {
        getSkillFile?(id: string, d: WorkflowNode["data"]): { path: string; content: string } | null;
      };
      if (gen?.getSkillFile) {
        const f = gen.getSkillFile(skillNode.id, skillNode.data);
        if (f) files.push(f);
      }
    }
  }

  // Generate sub-workflow files (inner command file + agent file if agent mode)
  for (const node of reachable) {
    if (node.data.type === "sub-workflow") {
      const gen = NODE_GENERATORS["sub-workflow"] as typeof NODE_GENERATORS["sub-workflow"] & {
        getSubWorkflowJSON?(id: string, d: WorkflowNode["data"]): WorkflowJSON | null;
        getAgentFile?(id: string, d: WorkflowNode["data"]): { path: string; content: string } | null;
      };
      const d = node.data as import("@/nodes/sub-agent-flow/types").SubAgentFlowNodeData;

      if (d.mode === "agent") {
        // Agent mode: generate inner workflow command file using label-based slug + agent file
        if (gen?.getSubWorkflowJSON) {
          const innerJSON = gen.getSubWorkflowJSON(node.id, node.data);
          if (innerJSON) {
            const innerFiles = generateWorkflowFiles(innerJSON);
            files.push(...innerFiles);
          }
        }
        if (gen?.getAgentFile) {
          const f = gen.getAgentFile(node.id, node.data);
          if (f) files.push(f);
        }
      } else {
        // Same-context mode: generate command file named by mermaid node ID
        if (gen?.getSubWorkflowJSON) {
          const innerJSON = gen.getSubWorkflowJSON(node.id, node.data);
          if (innerJSON) {
            const mid = mermaidId(node.id);
            const commandFile: GeneratedFile = {
              path: `.opencode/commands/${mid}.md`,
              content: buildCommandMarkdown(innerJSON),
            };
            files.push(commandFile);
            // Recursively collect nested agent/skill/sub-workflow files
            const innerAgentFiles = collectAgentFiles(innerJSON.nodes, innerJSON.edges);
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

  // Build set of skill node IDs so we can exclude their edges
  const skillNodeIds = new Set(nodes.filter((n) => n.data.type === "skill").map((n) => n.id));

  const remappedEdges = edges
    .filter((e) => !skillNodeIds.has(e.source) && !skillNodeIds.has(e.target))
    .map((e) => {
      const remappedTarget = endNodeIdMap.get(e.target);
      const remappedSource = endNodeIdMap.get(e.source);
      if (remappedTarget || remappedSource) {
        return { ...e, target: remappedTarget ?? e.target, source: remappedSource ?? e.source };
      }
      return e;
    });

  const nodeLines = dedupedNodes.map(mermaidNodeShape).filter(Boolean);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const edgeLines = remappedEdges.map((e) => mermaidEdge(e, nodeById));
  const mermaidInner = edgeLines.length > 0 ? [...nodeLines, "", ...edgeLines] : nodeLines;
  const mermaidBlock = ["```mermaid", "flowchart TD", ...mermaidInner, "```"].join("\n");
  const startNodeId = nodes.find((n) => n.data.type === "start")?.id ?? "start";
  const endNodeId   = canonicalEndId ?? nodes.find((n) => n.data.type === "end")?.id ?? "end";
  const executionGuide = `## Workflow Execution Guide
Follow the Mermaid flowchart above to execute the workflow starting from \`${mermaidId(startNodeId)}\` node. Each node type has specific execution methods as described below.
Split each flow path into a todo item using todowrite and todoread tools, and update the todo list correspondingly.

### Positional Arguments
Workflow arguments are **comma-separated and trimmed**. For example \`/workflow 2, 5, 10\` yields \`$1=2\`, \`$2=5\`, \`$3=10\`.

### Execution Methods by Node Type
- **Stadium nodes (Start / End)**: Entry and exit points of the workflow
- **Rectangle nodes (Agent: ...)**: Execute Agents via the spawn agent delegation system. If a \`params:\` line is present, pass those values as the agent's positional arguments (\`$1\`, \`$2\`, …). Values can be workflow-level positional args (e.g. \`$1\`), static references (e.g. \`{{name}}\`), or literal strings
- **Diamond nodes (AskUserQuestion:...)**: Use the AskUserQuestion tool to prompt the user and branch based on their response
- **Diamond nodes (Branch/Switch:...)**: Automatically branch based on the results of previous processing (see details section)
- **Rectangle nodes (Prompt nodes)**: Execute the prompts described in the details section below`;
  const promptDetails    = buildPromptDetailsSection(nodes, edges);
  const subAgentDetails  = buildSubAgentDetailsSection(nodes, edges, workflow.nodes, workflow.edges);
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
  if (subWorkflowDetails) parts.push("", subWorkflowDetails);
  if (ifElseDetails)   parts.push("", ifElseDetails);
  if (switchDetails)   parts.push("", switchDetails);
  if (askUserDetails)  parts.push("", askUserDetails);
  if (otherDetails)    parts.push("", otherDetails);
  return parts.join("\n") + "\n";
}
export function generateWorkflowFiles(workflow: WorkflowJSON): GeneratedFile[] {
  const safeName = workflow.name
    .replace(/[^a-z0-9\-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "workflow";
  const commandFile: GeneratedFile = {
    path: `.opencode/commands/${safeName}.md`,
    content: buildCommandMarkdown(workflow),
  };
  const agentFiles = collectAgentFiles(workflow.nodes, workflow.edges);
  return [commandFile, ...agentFiles];
}
export function getCommandMarkdown(workflow: WorkflowJSON): string {
  return buildCommandMarkdown(workflow);
}
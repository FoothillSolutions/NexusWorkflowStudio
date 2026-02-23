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
  "sub-agent":      subAgentGen,
  "sub-agent-flow": subAgentFlowGen,
  skill:            skillGen,
  "mcp-tool":       mcpToolGen,
  "if-else":        ifElseGen,
  switch:           switchGen,
  "ask-user":       askUserGen,
};
function mermaidNodeShape(node: WorkflowNode): string {
  const gen = NODE_GENERATORS[node.data.type];
  if (gen) return gen.getMermaidShape(node.id, node.data);
  return `    ${mermaidId(node.id)}["${mermaidLabel(node.data.label ?? node.data.type)}"]`;
}
function mermaidEdge(edge: WorkflowEdge): string {
  const srcId = mermaidId(edge.source);
  const tgtId = mermaidId(edge.target);
  const defaultHandles = new Set(["output", "input"]);
  const showLabel = edge.sourceHandle && !defaultHandles.has(edge.sourceHandle);
  const label = showLabel ? ` -- "${mermaidLabel(edge.sourceHandle!)}" -->` : " -->";
  return `    ${srcId}${label} ${tgtId}`;
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
function buildDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
  const sections: string[] = [];
  const SKIP = new Set(["start", "end", "prompt"]);
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
function buildCommandMarkdown(workflow: WorkflowJSON): string {
  const { name } = workflow;
  const { nodes, edges } = filterReachable(workflow.nodes, workflow.edges);
  const seenTypes = new Set<string>();
  const endNodeIdMap = new Map<string, string>();
  let canonicalEndId: string | null = null;
  const dedupedNodes = nodes.filter((n) => {
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
  const remappedEdges = edges.map((e) => {
    const remappedTarget = endNodeIdMap.get(e.target);
    const remappedSource = endNodeIdMap.get(e.source);
    if (remappedTarget || remappedSource) {
      return { ...e, target: remappedTarget ?? e.target, source: remappedSource ?? e.source };
    }
    return e;
  });
  const nodeLines = dedupedNodes.map(mermaidNodeShape);
  const edgeLines = remappedEdges.map((e) => mermaidEdge(e));
  const mermaidInner = edgeLines.length > 0 ? [...nodeLines, "", ...edgeLines] : nodeLines;
  const mermaidBlock = ["```mermaid", "flowchart TD", ...mermaidInner, "```"].join("\n");
  const executionGuide = `## Workflow Execution Guide
Follow the Mermaid flowchart above to execute the workflow. Each node type has specific execution methods as described below.
### Execution Methods by Node Type
- **Stadium nodes (Start / End)**: Entry and exit points of the workflow
- **Rectangle nodes (Sub-Agent: ...)**: Execute Sub-Agents
- **Diamond nodes (AskUserQuestion:...)**: Use the AskUserQuestion tool to prompt the user and branch based on their response
- **Diamond nodes (Branch/Switch:...)**: Automatically branch based on the results of previous processing (see details section)
- **Rectangle nodes (Prompt nodes)**: Execute the prompts described in the details section below`;
  const promptDetails = buildPromptDetailsSection(nodes, edges);
  const otherDetails  = buildDetailsSection(nodes, edges);
  const frontmatter   = `---\ndescription: ${name}\n---`;
  const parts = [frontmatter, mermaidBlock, "", executionGuide];
  if (promptDetails) parts.push("", promptDetails);
  if (otherDetails)  parts.push("", otherDetails);
  return parts.join("\n") + "\n";
}
export function generateWorkflowFiles(workflow: WorkflowJSON): GeneratedFile[] {
  const safeName = workflow.name
    .replace(/[^a-z0-9\-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "workflow";
  return [{ path: `commands/${safeName}.md`, content: buildCommandMarkdown(workflow) }];
}
export function getCommandMarkdown(workflow: WorkflowJSON): string {
  return buildCommandMarkdown(workflow);
}
import { WorkflowNodeType, type NodeType, type WorkflowEdge, type WorkflowNode } from "@/types/workflow";
import { generator as startGen } from "@/nodes/start/generator";
import { generator as endGen } from "@/nodes/end/generator";
import { generator as promptGen } from "@/nodes/prompt/generator";
import { generator as scriptGen } from "@/nodes/script/generator";
import { generator as subAgentGen } from "@/nodes/agent/generator";
import { generator as parallelAgentGen } from "@/nodes/parallel-agent/generator";
import { generator as subWorkflowGen } from "@/nodes/sub-workflow/generator";
import { generator as skillGen } from "@/nodes/skill/generator";
import { generator as documentGen } from "@/nodes/document/generator";
import { generator as mcpToolGen } from "@/nodes/mcp-tool/generator";
import { generator as ifElseGen } from "@/nodes/if-else/generator";
import { generator as switchGen } from "@/nodes/switch/generator";
import { generator as askUserGen } from "@/nodes/ask-user/generator";
import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";

export interface GeneratedFile {
  path: string;
  content: string;
}

export const NODE_GENERATORS: Record<NodeType, NodeGeneratorModule> = {
  [WorkflowNodeType.Start]: startGen,
  [WorkflowNodeType.End]: endGen,
  [WorkflowNodeType.Prompt]: promptGen,
  [WorkflowNodeType.Script]: scriptGen,
  [WorkflowNodeType.Agent]: subAgentGen,
  [WorkflowNodeType.ParallelAgent]: parallelAgentGen,
  [WorkflowNodeType.SubWorkflow]: subWorkflowGen,
  [WorkflowNodeType.Skill]: skillGen,
  [WorkflowNodeType.Document]: documentGen,
  [WorkflowNodeType.McpTool]: mcpToolGen,
  [WorkflowNodeType.IfElse]: ifElseGen,
  [WorkflowNodeType.Switch]: switchGen,
  [WorkflowNodeType.AskUser]: askUserGen,
};

const SKILL_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function resolveSkillReferenceName(d: {
  skillName?: string;
  label?: string;
  name?: string;
}): string | null {
  const candidates = [d.skillName, d.label, d.name];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && SKILL_SLUG_REGEX.test(trimmed)) return trimmed;
  }
  return null;
}

export function mermaidNodeShape(node: WorkflowNode): string {
  if (node.data.type === WorkflowNodeType.Skill) return "";
  if (node.data.type === WorkflowNodeType.Document) return "";
  if (node.data.type === WorkflowNodeType.Script) return "";

  const generator = NODE_GENERATORS[node.data.type];
  if (generator) return generator.getMermaidShape(node.id, node.data);

  return `    ${mermaidId(node.id)}["${mermaidLabel(node.data.label ?? node.data.type)}"]`;
}

export function mermaidEdge(
  edge: WorkflowEdge,
  nodeById?: Map<string, WorkflowNode>,
): string {
  const srcId = mermaidId(edge.source);
  const tgtId = mermaidId(edge.target);
  const defaultHandles = new Set(["output", "input"]);
  const sourceHandle = edge.sourceHandle;
  const DECIMAL_RADIX = 10;

  if (typeof sourceHandle === "string" && !defaultHandles.has(sourceHandle)) {
    let raw: string = sourceHandle;
    const boolHandles = new Set(["true", "false"]);
    const optionMatch = raw.match(/^option-(\d+)$/);
    if (optionMatch && nodeById) {
      const srcNode = nodeById.get(edge.source);
      if (srcNode?.data?.type === WorkflowNodeType.AskUser) {
        const d = srcNode.data as import("@/types/workflow").AskUserNodeData;
        const idx = Number.parseInt(optionMatch[1], DECIMAL_RADIX);
        const opt = d.options?.[idx];
        if (opt && typeof opt === "object" && opt.label) {
          raw = opt.label;
        }
      }
    }

    const parallelMatch = raw.match(/^branch-(\d+)$/);
    if (parallelMatch && nodeById) {
      const srcNode = nodeById.get(edge.source);
      if (srcNode?.data?.type === WorkflowNodeType.ParallelAgent) {
        const d = srcNode.data as import("@/types/workflow").ParallelAgentNodeData;
        const idx = Number.parseInt(parallelMatch[1], DECIMAL_RADIX);
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

export function filterReachable(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);

  const visited = new Set<string>();
  const queue = nodes
    .filter((node) => node.data.type === WorkflowNodeType.Start)
    .map((node) => node.id);

  for (const id of queue) visited.add(id);

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;

    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return {
    nodes: nodes.filter((node) => visited.has(node.id)),
    edges: edges.filter(
      (edge) => visited.has(edge.source) && visited.has(edge.target),
    ),
  };
}

export function topologicalOrder(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    order.push(id);

    for (const next of adjacency.get(id) ?? []) {
      const degree = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }

  return order;
}


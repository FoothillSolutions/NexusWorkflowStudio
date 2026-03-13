"use client";

import { useCallback, useMemo } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import type { AskUserNodeData, SubWorkflowNodeData, WorkflowEdge, WorkflowNode } from "@/types/workflow";

export interface ConnectedNode {
  edge: WorkflowEdge;
  node: WorkflowNode;
}

export interface AvailableResource {
  value: string;
  label: string;
  kind: "doc" | "skill";
}

type StoreSnapshot = ReturnType<typeof useWorkflowStore.getState>;

function getActiveSubWorkflowParentNode(state: StoreSnapshot): WorkflowNode | undefined {
  if (!state.activeSubWorkflowNodeId) return undefined;

  return (
    state.subWorkflowParentNodes.find((node) => node.id === state.activeSubWorkflowNodeId)
    ?? state.nodes.find((node) => node.id === state.activeSubWorkflowNodeId)
  );
}

function findNodeContext(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeId: string,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  if (nodes.some((node) => node.id === nodeId)) {
    return { nodes, edges };
  }

  for (const node of nodes) {
    if (node.data?.type !== "sub-workflow") continue;

    const subWorkflowData = node.data as SubWorkflowNodeData;
    const nestedContext = findNodeContext(subWorkflowData.subNodes ?? [], subWorkflowData.subEdges ?? [], nodeId);
    if (nestedContext) {
      return nestedContext;
    }
  }

  return null;
}

function resolveNodesAndEdges(state: StoreSnapshot, nodeId: string) {
  if (!nodeId) {
    return { nodes: state.nodes, edges: state.edges };
  }

  const isInActiveSubWorkflow = state.subWorkflowNodes.some((node) => node.id === nodeId);
  if (isInActiveSubWorkflow) {
    const activeParentNode = getActiveSubWorkflowParentNode(state);
    if (activeParentNode?.data?.type === "sub-workflow") {
      const subWorkflowData = activeParentNode.data as SubWorkflowNodeData;
      return {
        nodes: state.subWorkflowNodes,
        edges: subWorkflowData.subEdges ?? [],
      };
    }
  }

  return findNodeContext(state.nodes, state.edges, nodeId) ?? {
    nodes: isInActiveSubWorkflow ? state.subWorkflowNodes : state.nodes,
    edges: state.edges,
  };
}

function buildEdgeKey(
  state: StoreSnapshot,
  nodeId: string,
  targetHandle: "skills" | "docs",
): string {
  const { edges } = resolveNodesAndEdges(state, nodeId);
  return edges
    .filter((edge) => edge.target === nodeId && edge.targetHandle === targetHandle)
    .map((edge) => `${edge.id}:${edge.source}`)
    .join(",");
}

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value != null;
}

function getUpstreamParallelAgentIds(state: StoreSnapshot, nodeId: string): string[] {
  const { nodes, edges } = resolveNodesAndEdges(state, nodeId);
  return edges
    .filter((e) => e.target === nodeId && e.targetHandle !== "skills" && e.targetHandle !== "docs")
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter((n): n is NonNullable<typeof n> => !!n && n.data?.type === "parallel-agent")
    .map((n) => n.id);
}

export function useConnectedResources(nodeId?: string) {
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);

  const hasImmediateUpstreamParallelAgent = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return false;
        return getUpstreamParallelAgentIds(s, nodeId).length > 0;
      },
      [nodeId],
    ),
  );

  const skillEdgeKey = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return "";
        return buildEdgeKey(s, nodeId, "skills");
      },
      [nodeId],
    ),
  );

  const connectedSkills = useMemo(() => {
    if (!skillEdgeKey) return [] as ConnectedNode[];
    const state = useWorkflowStore.getState();
    const { nodes, edges } = resolveNodesAndEdges(state, nodeId ?? "");
    return edges
      .filter((e) => e.target === nodeId && e.targetHandle === "skills")
      .map((e) => ({ edge: e, node: nodes.find((n) => n.id === e.source) }))
      .filter((item): item is ConnectedNode => isNonNullable(item.node));
  }, [skillEdgeKey, nodeId]);

  const docEdgeKey = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return "";
        return buildEdgeKey(s, nodeId, "docs");
      },
      [nodeId],
    ),
  );

  const connectedDocs = useMemo(() => {
    if (!docEdgeKey) return [] as ConnectedNode[];
    const state = useWorkflowStore.getState();
    const { nodes, edges } = resolveNodesAndEdges(state, nodeId ?? "");
    return edges
      .filter((e) => e.target === nodeId && e.targetHandle === "docs")
      .map((e) => ({ edge: e, node: nodes.find((n) => n.id === e.source) }))
      .filter((item): item is ConnectedNode => isNonNullable(item.node));
  }, [docEdgeKey, nodeId]);

  const resourceKey = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return "";
        const { nodes, edges } = resolveNodesAndEdges(s, nodeId);
        const upstreamParallelIds = new Set(getUpstreamParallelAgentIds(s, nodeId));
        const parts: string[] = [];
        for (const e of edges) {
          if (e.target !== nodeId && !upstreamParallelIds.has(e.target)) continue;
          const n = nodes.find((nd) => nd.id === e.source);
          if (!n) continue;
          if (n.data?.type === "document") {
            const d = n.data as Record<string, unknown>;
            parts.push(`doc:${e.source}:${d.docName ?? ""}:${d.fileExtension ?? ""}:${d.label ?? ""}`);
          } else if (n.data?.type === "skill") {
            const d = n.data as Record<string, unknown>;
            parts.push(`skill:${e.source}:${d.skillName ?? ""}:${d.label ?? ""}`);
          }
        }
        return parts.sort().join("|");
      },
      [nodeId],
    ),
  );

  const availableResources = useMemo((): AvailableResource[] => {
    if (!resourceKey) return [];
    const state = useWorkflowStore.getState();
    const { nodes, edges } = resolveNodesAndEdges(state, nodeId ?? "");
    const upstreamParallelIds = new Set(getUpstreamParallelAgentIds(state, nodeId ?? ""));

    const resources: AvailableResource[] = [];
    const seenValues = new Set<string>();
    for (const edge of edges) {
      if (edge.target !== nodeId && !upstreamParallelIds.has(edge.target)) continue;
      const src = nodes.find((n) => n.id === edge.source);
      if (!src) continue;

      if (src.data?.type === "document") {
        const d = src.data as { docName?: string; fileExtension?: string; label?: string; name?: string };
        const docName = d.docName?.trim();
        const ext = d.fileExtension || "md";
        const displayName = docName ? `${docName}.${ext}` : (d.label || d.name || edge.source);
        const value = docName ? `doc:${docName}.${ext}` : `doc-id:${edge.source}`;
        if (seenValues.has(value)) continue;
        seenValues.add(value);
        resources.push({
          value,
          label: `📄 ${displayName}`,
          kind: "doc",
        });
      } else if (src.data?.type === "skill") {
        const d = src.data as { skillName?: string; label?: string; name?: string };
        const skillName = d.skillName?.trim() || d.label?.trim();
        const displayName = skillName || d.name || edge.source;
        const value = skillName ? `skill:${skillName}` : `skill-id:${edge.source}`;
        if (seenValues.has(value)) continue;
        seenValues.add(value);
        resources.push({
          value,
          label: `⚡ ${displayName}`,
          kind: "skill",
        });
      }
    }
    return resources;
  }, [resourceKey, nodeId]);

  return {
    connectedSkills,
    connectedDocs,
    availableResources,
    deleteEdge,
    hasImmediateUpstreamParallelAgent,
  };
}

// ── Connected-node context (upstream / downstream flow neighbours) ────────

export interface NodeSummary {
  id: string;
  type: string;
  label: string;
  name: string;
  /** Truncated prompt text (agent / skill / prompt nodes only) */
  promptText?: string;
  /** Extra context depending on node type */
  description?: string;
  /** Branch conditions for if-else / switch */
  branches?: string[];
}

export interface ConnectedNodeContext {
  upstream: NodeSummary[];
  downstream: NodeSummary[];
}

/** Max characters of promptText to include per neighbour */
const PROMPT_EXCERPT_LIMIT = 300;

function summariseNode(node: WorkflowNode): NodeSummary {
  const d = node.data ?? {};
  const summary: NodeSummary = {
    id: node.id,
    type: (d.type as string) ?? "unknown",
    label: (d.label as string) ?? "",
    name: (d.name as string) ?? "",
  };

  // Include prompt text for content-bearing nodes
  if (typeof d.promptText === "string" && d.promptText.trim()) {
    summary.promptText =
      d.promptText.length > PROMPT_EXCERPT_LIMIT
        ? d.promptText.slice(0, PROMPT_EXCERPT_LIMIT) + "…"
        : d.promptText;
  }

  // Description
  if (typeof d.description === "string" && d.description.trim()) {
    summary.description = d.description;
  }

  // Question text for ask-user nodes
  if (d.type === "ask-user") {
    const questionText = (d as AskUserNodeData).questionText?.trim();
    if (questionText) {
      summary.description = summary.description
        ? `${summary.description}\nQuestion: ${questionText}`
        : questionText;
    }
  }

  // Branch conditions for if-else / switch
  const branchConditions = ("branches" in d && Array.isArray(d.branches) ? d.branches : [])
    .flatMap((branch) => {
      if (typeof branch !== "object" || branch === null || !("condition" in branch)) {
        return [];
      }

      return typeof branch.condition === "string" && branch.condition.trim()
        ? [branch.condition]
        : [];
    });
  if (branchConditions.length > 0) {
    summary.branches = branchConditions;
  }

  return summary;
}

/**
 * Pure (non-hook) helper that reads the workflow store snapshot to collect
 * upstream and downstream flow-connected nodes for a given node.
 *
 * "Flow" edges are those whose targetHandle is NOT "skills" or "docs".
 * Traverses up to `maxHops` in each direction (default 2).
 */
export function getConnectedNodeContext(
  nodeId: string | null | undefined,
  maxHops = 2,
): ConnectedNodeContext {
  if (!nodeId) return { upstream: [], downstream: [] };
  const state = useWorkflowStore.getState();
  const { nodes, edges } = resolveNodesAndEdges(state, nodeId);

  const isFlowEdge = (e: { targetHandle?: string | null }) =>
    e.targetHandle !== "skills" && e.targetHandle !== "docs";

  // Walk upstream (nodes whose output connects to this node's input)
  const upstream: NodeSummary[] = [];
  const visitedUp = new Set<string>([nodeId]);
  let frontierUp = [nodeId];
  for (let hop = 0; hop < maxHops && frontierUp.length > 0; hop++) {
    const nextFrontier: string[] = [];
    for (const current of frontierUp) {
      for (const edge of edges) {
        if (edge.target === current && isFlowEdge(edge) && !visitedUp.has(edge.source)) {
          visitedUp.add(edge.source);
          const srcNode = nodes.find((n) => n.id === edge.source);
          if (srcNode) {
            upstream.push(summariseNode(srcNode));
            nextFrontier.push(edge.source);
          }
        }
      }
    }
    frontierUp = nextFrontier;
  }

  // Walk downstream (nodes this node connects to)
  const downstream: NodeSummary[] = [];
  const visitedDown = new Set<string>([nodeId]);
  let frontierDown = [nodeId];
  for (let hop = 0; hop < maxHops && frontierDown.length > 0; hop++) {
    const nextFrontier: string[] = [];
    for (const current of frontierDown) {
      for (const edge of edges) {
        if (edge.source === current && isFlowEdge(edge) && !visitedDown.has(edge.target)) {
          visitedDown.add(edge.target);
          const tgtNode = nodes.find((n) => n.id === edge.target);
          if (tgtNode) {
            downstream.push(summariseNode(tgtNode));
            nextFrontier.push(edge.target);
          }
        }
      }
    }
    frontierDown = nextFrontier;
  }

  return { upstream, downstream };
}

/**
 * Pure (non-hook) helper that reads the workflow store snapshot to extract
 * connected skill and document names for a given node.
 * Safe to call from callbacks / outside React render.
 */
export function getConnectedResourceNames(
  nodeId: string | null | undefined,
): { skills: string[]; docs: string[] } {
  if (!nodeId) return { skills: [], docs: [] };
  const state = useWorkflowStore.getState();
  const { nodes, edges } = resolveNodesAndEdges(state, nodeId);
  const skills: string[] = [];
  const docs: string[] = [];

  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    const src = nodes.find((n) => n.id === edge.source);
    if (!src) continue;

    if (src.data?.type === "skill") {
      const d = src.data as { skillName?: string; label?: string; name?: string };
      const name = d.skillName?.trim() || d.label?.trim() || d.name?.trim();
      if (name) skills.push(name);
    } else if (src.data?.type === "document") {
      const d = src.data as { docName?: string; fileExtension?: string; label?: string; name?: string };
      const docName = d.docName?.trim();
      if (docName) {
        const ext = d.fileExtension || "md";
        docs.push(`${docName}.${ext}`);
      } else {
        const fallback = d.label?.trim() || d.name?.trim();
        if (fallback) docs.push(fallback);
      }
    }
  }

  return { skills, docs };
}


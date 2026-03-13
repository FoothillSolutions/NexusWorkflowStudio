"use client";

import { useCallback, useMemo } from "react";
import { useWorkflowStore } from "@/store/workflow-store";

export interface ConnectedNode {
  edge: { id: string; source: string; target: string; targetHandle?: string | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: { id: string; data: any };
}

export interface AvailableResource {
  value: string;
  label: string;
  kind: "doc" | "skill";
}

type StoreSnapshot = ReturnType<typeof useWorkflowStore.getState>;

function resolveNodesAndEdges(state: StoreSnapshot, nodeId: string) {
  const inMain = state.nodes.some((n) => n.id === nodeId);
  const nodes = inMain ? state.nodes : state.subWorkflowNodes ?? [];
  const edges = inMain
    ? state.edges
    : (() => {
        for (const n of state.nodes) {
          if (n.data?.type !== "sub-workflow") continue;
          const data = n.data as { subEdges?: typeof state.edges };
          if (data.subEdges?.some((e) => e.source === nodeId || e.target === nodeId)) {
            return data.subEdges;
          }
        }
        return state.edges;
      })();

  return { nodes, edges };
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
        return s.edges
          .filter((e) => e.target === nodeId && e.targetHandle === "skills")
          .map((e) => `${e.id}:${e.source}`)
          .join(",");
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
      .filter((item): item is { edge: typeof item.edge; node: NonNullable<typeof item.node> } => !!item.node) as ConnectedNode[];
  }, [skillEdgeKey, nodeId]);

  const docEdgeKey = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return "";
        return s.edges
          .filter((e) => e.target === nodeId && e.targetHandle === "docs")
          .map((e) => `${e.id}:${e.source}`)
          .join(",");
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
      .filter((item): item is { edge: typeof item.edge; node: NonNullable<typeof item.node> } => !!item.node) as ConnectedNode[];
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

function summariseNode(node: { id: string; data: Record<string, unknown> }): NodeSummary {
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
  if (typeof d.questionText === "string" && d.questionText.trim()) {
    summary.description = d.questionText;
  }

  // Branch conditions for if-else / switch
  if (Array.isArray(d.branches)) {
    summary.branches = (d.branches as Array<{ label?: string; condition?: string; instructions?: string; spawnCount?: number }>).map((b) => {
      if (typeof b.condition === "string") {
        return `${b.label ?? ""}: ${b.condition ?? ""}`.trim();
      }
      const count = Math.max(1, Number(b.spawnCount ?? 1));
      const base = `${b.label ?? "Branch"} x${count}`;
      return b.instructions?.trim() ? `${base}: ${b.instructions.trim()}` : base;
    });
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

  // Determine which node/edge pool to search
  const inMain = state.nodes.some((n) => n.id === nodeId);
  const nodes = inMain ? state.nodes : state.subWorkflowNodes ?? [];
  const edges = inMain
    ? state.edges
    : (() => {
        // For sub-workflow nodes, find the parent sub-workflow node and use its subEdges
        for (const n of state.nodes) {
          if (n.data?.type === "sub-workflow") {
            const swd = n.data as { subEdges?: Array<{ id: string; source: string; target: string; targetHandle?: string | null }> };
            if (swd.subEdges?.some((e) => e.source === nodeId || e.target === nodeId)) {
              return swd.subEdges as typeof state.edges;
            }
          }
        }
        return state.edges;
      })();

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
            upstream.push(summariseNode(srcNode as { id: string; data: Record<string, unknown> }));
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
            downstream.push(summariseNode(tgtNode as { id: string; data: Record<string, unknown> }));
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
  const skills: string[] = [];
  const docs: string[] = [];

  for (const edge of state.edges) {
    if (edge.target !== nodeId) continue;
    const src = state.nodes.find((n) => n.id === edge.source);
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


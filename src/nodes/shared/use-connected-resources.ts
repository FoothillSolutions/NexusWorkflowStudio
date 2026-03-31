"use client";

import { useCallback, useMemo } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import type {
  AskUserNodeData,
  SubWorkflowNodeData,
  WorkflowEdge,
  WorkflowNode,
} from "@/types/workflow";
import { getDocumentRelativePath } from "@/nodes/document/utils";
import { getSkillScriptBaseName, getSkillScriptFileName } from "@/nodes/skill/script-utils";

export interface ConnectedNode {
  edge: WorkflowEdge;
  node: WorkflowNode;
}

export interface AvailableResource {
  value: string;
  label: string;
  kind: "doc" | "skill" | "script";
}

type StoreSnapshot = ReturnType<typeof useWorkflowStore.getState>;

function getActiveSubWorkflowParentNode(state: StoreSnapshot): WorkflowNode | undefined {
  if (!state.activeSubWorkflowNodeId) return undefined;

  return (
    state.subWorkflowParentNodes.find((node) => node.id === state.activeSubWorkflowNodeId) ??
    state.nodes.find((node) => node.id === state.activeSubWorkflowNodeId)
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
    const nestedContext = findNodeContext(
      subWorkflowData.subNodes ?? [],
      subWorkflowData.subEdges ?? [],
      nodeId,
    );
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
  targetHandle: "skills" | "docs" | "scripts",
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
    .filter(
      (edge) =>
        edge.target === nodeId &&
        edge.targetHandle !== "skills" &&
        edge.targetHandle !== "docs",
    )
    .map((edge) => nodes.find((node) => node.id === edge.source))
    .filter((node): node is NonNullable<typeof node> => !!node && node.data?.type === "parallel-agent")
    .map((node) => node.id);
}

export function useConnectedResources(nodeId?: string) {
  const deleteEdge = useWorkflowStore((state) => state.deleteEdge);

  const hasImmediateUpstreamParallelAgent = useWorkflowStore(
    useCallback(
      (state) => {
        if (!nodeId) return false;
        return getUpstreamParallelAgentIds(state, nodeId).length > 0;
      },
      [nodeId],
    ),
  );

  const skillEdgeKey = useWorkflowStore(
    useCallback(
      (state) => {
        if (!nodeId) return "";
        return buildEdgeKey(state, nodeId, "skills");
      },
      [nodeId],
    ),
  );

  const connectedSkills = useMemo(() => {
    if (!skillEdgeKey) return [] as ConnectedNode[];
    const state = useWorkflowStore.getState();
    const { nodes, edges } = resolveNodesAndEdges(state, nodeId ?? "");
    return edges
      .filter((edge) => edge.target === nodeId && edge.targetHandle === "skills")
      .map((edge) => ({ edge, node: nodes.find((node) => node.id === edge.source) }))
      .filter((item): item is ConnectedNode => isNonNullable(item.node));
  }, [skillEdgeKey, nodeId]);

  const docEdgeKey = useWorkflowStore(
    useCallback(
      (state) => {
        if (!nodeId) return "";
        return buildEdgeKey(state, nodeId, "docs");
      },
      [nodeId],
    ),
  );

  const connectedDocs = useMemo(() => {
    if (!docEdgeKey) return [] as ConnectedNode[];
    const state = useWorkflowStore.getState();
    const { nodes, edges } = resolveNodesAndEdges(state, nodeId ?? "");
    return edges
      .filter((edge) => edge.target === nodeId && edge.targetHandle === "docs")
      .map((edge) => ({ edge, node: nodes.find((node) => node.id === edge.source) }))
      .filter((item): item is ConnectedNode => isNonNullable(item.node));
  }, [docEdgeKey, nodeId]);

  const scriptEdgeKey = useWorkflowStore(
    useCallback(
      (state) => {
        if (!nodeId) return "";
        return buildEdgeKey(state, nodeId, "scripts");
      },
      [nodeId],
    ),
  );

  const connectedScripts = useMemo(() => {
    if (!scriptEdgeKey) return [] as ConnectedNode[];
    const state = useWorkflowStore.getState();
    const { nodes, edges } = resolveNodesAndEdges(state, nodeId ?? "");
    return edges
      .filter((edge) => edge.target === nodeId && edge.targetHandle === "scripts")
      .map((edge) => ({ edge, node: nodes.find((node) => node.id === edge.source) }))
      .filter((item): item is ConnectedNode => isNonNullable(item.node));
  }, [scriptEdgeKey, nodeId]);

  const resourceKey = useWorkflowStore(
    useCallback(
      (state) => {
        if (!nodeId) return "";
        const { nodes, edges } = resolveNodesAndEdges(state, nodeId);
        const upstreamParallelIds = new Set(getUpstreamParallelAgentIds(state, nodeId));
        const parts: string[] = [];
        for (const edge of edges) {
          if (edge.target !== nodeId && !upstreamParallelIds.has(edge.target)) continue;
          const node = nodes.find((candidate) => candidate.id === edge.source);
          if (!node) continue;

          if (node.data?.type === "document") {
            const data = node.data as import("@/nodes/document/types").DocumentNodeData;
            parts.push(`doc:${edge.source}:${getDocumentRelativePath(data) ?? ""}:${data.label ?? ""}`);
          } else if (node.data?.type === "skill") {
            const data = node.data as Record<string, unknown>;
            parts.push(`skill:${edge.source}:${data.skillName ?? ""}:${data.label ?? ""}`);
          } else if (edge.targetHandle === "scripts" && node.data?.type === "script") {
            parts.push(`script:${edge.source}:${getSkillScriptFileName(node.data)}:${node.data.label ?? ""}`);
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
      const source = nodes.find((node) => node.id === edge.source);
      if (!source) continue;

      if (source.data?.type === "document") {
        const data = source.data as import("@/nodes/document/types").DocumentNodeData;
        const relativePath = getDocumentRelativePath(data);
        const displayName = relativePath || data.label || data.name || edge.source;
        const value = relativePath ? `doc:${relativePath}` : `doc-id:${edge.source}`;
        if (seenValues.has(value)) continue;
        seenValues.add(value);
        resources.push({ value, label: `📄 ${displayName}`, kind: "doc" });
      } else if (source.data?.type === "skill") {
        const data = source.data as { skillName?: string; label?: string; name?: string };
        const skillName = data.skillName?.trim() || data.label?.trim();
        const displayName = skillName || data.name || edge.source;
        const value = skillName ? `skill:${skillName}` : `skill-id:${edge.source}`;
        if (seenValues.has(value)) continue;
        seenValues.add(value);
        resources.push({ value, label: `⚡ ${displayName}`, kind: "skill" });
      } else if (edge.targetHandle === "scripts" && source.data?.type === "script") {
        const fileName = getSkillScriptFileName(source.data);
        const value = `script:${fileName}`;
        if (seenValues.has(value)) continue;
        seenValues.add(value);
        resources.push({ value, label: `🧩 ${fileName}`, kind: "script" });
      }
    }
    return resources;
  }, [resourceKey, nodeId]);

  return {
    connectedSkills,
    connectedDocs,
    connectedScripts,
    availableResources,
    deleteEdge,
    hasImmediateUpstreamParallelAgent,
  };
}

export interface NodeSummary {
  id: string;
  type: string;
  label: string;
  name: string;
  promptText?: string;
  description?: string;
  branches?: string[];
}

export interface ConnectedNodeContext {
  upstream: NodeSummary[];
  downstream: NodeSummary[];
}

const PROMPT_EXCERPT_LIMIT = 300;

function summariseNode(node: WorkflowNode): NodeSummary {
  const data = node.data ?? {};
  const summary: NodeSummary = {
    id: node.id,
    type: (data.type as string) ?? "unknown",
    label: (data.label as string) ?? "",
    name: (data.name as string) ?? "",
  };

  if (typeof data.promptText === "string" && data.promptText.trim()) {
    summary.promptText =
      data.promptText.length > PROMPT_EXCERPT_LIMIT
        ? `${data.promptText.slice(0, PROMPT_EXCERPT_LIMIT)}…`
        : data.promptText;
  }

  if (typeof data.description === "string" && data.description.trim()) {
    summary.description = data.description;
  }

  if (data.type === "ask-user") {
    const questionText = (data as AskUserNodeData).questionText?.trim();
    if (questionText) {
      summary.description = summary.description
        ? `${summary.description}\nQuestion: ${questionText}`
        : questionText;
    }
  }

  const branchConditions = (
    "branches" in data && Array.isArray(data.branches) ? data.branches : []
  ).flatMap((branch) => {
    if (
      typeof branch !== "object" ||
      branch === null ||
      !("condition" in branch)
    ) {
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

export function getConnectedNodeContext(
  nodeId: string | null | undefined,
  maxHops = 2,
): ConnectedNodeContext {
  if (!nodeId) return { upstream: [], downstream: [] };
  const state = useWorkflowStore.getState();
  const { nodes, edges } = resolveNodesAndEdges(state, nodeId);

  const isFlowEdge = (edge: { targetHandle?: string | null }) =>
    edge.targetHandle !== "skills" && edge.targetHandle !== "docs";

  const upstream: NodeSummary[] = [];
  const visitedUp = new Set<string>([nodeId]);
  let frontierUp = [nodeId];
  for (let hop = 0; hop < maxHops && frontierUp.length > 0; hop += 1) {
    const nextFrontier: string[] = [];
    for (const current of frontierUp) {
      for (const edge of edges) {
        if (edge.target === current && isFlowEdge(edge) && !visitedUp.has(edge.source)) {
          visitedUp.add(edge.source);
          const sourceNode = nodes.find((node) => node.id === edge.source);
          if (sourceNode) {
            upstream.push(summariseNode(sourceNode));
            nextFrontier.push(edge.source);
          }
        }
      }
    }
    frontierUp = nextFrontier;
  }

  const downstream: NodeSummary[] = [];
  const visitedDown = new Set<string>([nodeId]);
  let frontierDown = [nodeId];
  for (let hop = 0; hop < maxHops && frontierDown.length > 0; hop += 1) {
    const nextFrontier: string[] = [];
    for (const current of frontierDown) {
      for (const edge of edges) {
        if (edge.source === current && isFlowEdge(edge) && !visitedDown.has(edge.target)) {
          visitedDown.add(edge.target);
          const targetNode = nodes.find((node) => node.id === edge.target);
          if (targetNode) {
            downstream.push(summariseNode(targetNode));
            nextFrontier.push(edge.target);
          }
        }
      }
    }
    frontierDown = nextFrontier;
  }

  return { upstream, downstream };
}

export function getConnectedResourceNames(
  nodeId: string | null | undefined,
): { skills: string[]; docs: string[]; scripts: string[] } {
  if (!nodeId) return { skills: [], docs: [], scripts: [] };
  const state = useWorkflowStore.getState();
  const { nodes, edges } = resolveNodesAndEdges(state, nodeId);
  const skills: string[] = [];
  const docs: string[] = [];
  const scripts: string[] = [];

  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    const source = nodes.find((node) => node.id === edge.source);
    if (!source) continue;

    if (source.data?.type === "skill") {
      const data = source.data as { skillName?: string; label?: string; name?: string };
      const name = data.skillName?.trim() || data.label?.trim() || data.name?.trim();
      if (name) skills.push(name);
    } else if (source.data?.type === "document") {
      const data = source.data as {
        docName?: string;
        fileExtension?: string;
        label?: string;
        name?: string;
      };
      const docName = data.docName?.trim();
      if (docName) {
        const extension = data.fileExtension || "md";
        docs.push(`${docName}.${extension}`);
      } else {
        const fallback = data.label?.trim() || data.name?.trim();
        if (fallback) docs.push(fallback);
      }
    } else if (edge.targetHandle === "scripts" && source.data?.type === "script") {
      scripts.push(getSkillScriptBaseName(source.data));
    }
  }

  return { skills, docs, scripts };
}


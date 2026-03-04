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

export function useConnectedResources(nodeId?: string) {
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);

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
    return state.edges
      .filter((e) => e.target === nodeId && e.targetHandle === "skills")
      .map((e) => ({ edge: e, node: state.nodes.find((n) => n.id === e.source) }))
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
    return state.edges
      .filter((e) => e.target === nodeId && e.targetHandle === "docs")
      .map((e) => ({ edge: e, node: state.nodes.find((n) => n.id === e.source) }))
      .filter((item): item is { edge: typeof item.edge; node: NonNullable<typeof item.node> } => !!item.node) as ConnectedNode[];
  }, [docEdgeKey, nodeId]);

  const resourceKey = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return "";
        const parts: string[] = [];
        for (const e of s.edges) {
          if (e.target !== nodeId) continue;
          const n = s.nodes.find((nd) => nd.id === e.source);
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

    const resources: AvailableResource[] = [];
    for (const edge of state.edges) {
      if (edge.target !== nodeId) continue;
      const src = state.nodes.find((n) => n.id === edge.source);
      if (!src) continue;

      if (src.data?.type === "document") {
        const d = src.data as { docName?: string; fileExtension?: string; label?: string; name?: string };
        const docName = d.docName?.trim();
        const ext = d.fileExtension || "md";
        const displayName = docName ? `${docName}.${ext}` : (d.label || d.name || edge.source);
        resources.push({
          value: docName ? `doc:${docName}.${ext}` : `doc-id:${edge.source}`,
          label: `📄 ${displayName}`,
          kind: "doc",
        });
      } else if (src.data?.type === "skill") {
        const d = src.data as { skillName?: string; label?: string; name?: string };
        const skillName = d.skillName?.trim() || d.label?.trim();
        const displayName = skillName || d.name || edge.source;
        resources.push({
          value: skillName ? `skill:${skillName}` : `skill-id:${edge.source}`,
          label: `⚡ ${displayName}`,
          kind: "skill",
        });
      }
    }
    return resources;
  }, [resourceKey, nodeId]);

  return { connectedSkills, connectedDocs, availableResources, deleteEdge };
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


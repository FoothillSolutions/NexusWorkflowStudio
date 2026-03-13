import { customAlphabet } from "nanoid";
import type {
  SubWorkflowNodeData,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
} from "@/types/workflow";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);
const PASTE_OFFSET_STEP = 40;

interface WorkflowClipboardSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  bounds: {
    minX: number;
    minY: number;
  };
  pasteCount: number;
}

interface CopyNodesToWorkflowClipboardParams {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeIds?: string[];
}

interface PasteNodesFromWorkflowClipboardParams {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  targetPosition?: { x: number; y: number };
}

interface PastedWorkflowSelection {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  pastedNodeIds: string[];
}

let clipboardSnapshot: WorkflowClipboardSnapshot | null = null;

function getSelectionBounds(nodes: WorkflowNode[]): { minX: number; minY: number } {
  return nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.position.x),
      minY: Math.min(bounds.minY, node.position.y),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY },
  );
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizeEdgeForClipboard(edge: WorkflowEdge): WorkflowEdge {
  const cloned = cloneValue(edge) as WorkflowEdge & { selected?: boolean };
  const { selected, ...rest } = cloned;
  void selected;
  return rest as WorkflowEdge;
}

function sanitizeNodeForClipboard(node: WorkflowNode): WorkflowNode {
  const cloned = cloneValue(node) as WorkflowNode & {
    measured?: unknown;
    dragging?: boolean;
    selected?: boolean;
  };
  const { measured, dragging, selected, ...rest } = cloned;
  void measured;
  void dragging;
  void selected;

  if (rest.data?.type === "sub-workflow") {
    const data = rest.data as SubWorkflowNodeData;
    const sanitizedSubNodes = (data.subNodes ?? []).map(sanitizeNodeForClipboard);
    return {
      ...rest,
      data: {
        ...data,
        subNodes: sanitizedSubNodes,
        subEdges: (data.subEdges ?? []).map(sanitizeEdgeForClipboard),
        nodeCount: sanitizedSubNodes.length,
      } as WorkflowNodeData,
    } as WorkflowNode;
  }

  return rest as WorkflowNode;
}

function createFreshNodeId(node: Pick<WorkflowNode, "data" | "type">): string {
  const nodeType = node.data?.type ?? node.type ?? "node";
  return `${nodeType}-${nanoid(8)}`;
}

function cloneNodeWithFreshIds(
  node: WorkflowNode,
  options: { offsetX: number; offsetY: number; selected: boolean },
): WorkflowNode {
  const cloned = cloneValue(node);
  const newId = createFreshNodeId(cloned);
  let nextData = {
    ...cloned.data,
    name: newId,
  } as WorkflowNodeData;

  if (nextData.type === "sub-workflow") {
    const nested = remapNodesAndEdges(nextData.subNodes ?? [], nextData.subEdges ?? [], {
      offsetX: 0,
      offsetY: 0,
      selected: false,
    });
    nextData = {
      ...nextData,
      subNodes: nested.nodes,
      subEdges: nested.edges,
      nodeCount: nested.nodes.length,
    } as WorkflowNodeData;
  }

  return {
    ...cloned,
    id: newId,
    position: {
      x: cloned.position.x + options.offsetX,
      y: cloned.position.y + options.offsetY,
    },
    selected: options.selected,
    data: nextData,
  } as WorkflowNode;
}

function remapNodesAndEdges(
  sourceNodes: WorkflowNode[],
  sourceEdges: WorkflowEdge[],
  options: { offsetX: number; offsetY: number; selected: boolean },
): PastedWorkflowSelection {
  const idMap = new Map<string, string>();
  const remappedNodes = sourceNodes.map((node) => {
    const remappedNode = cloneNodeWithFreshIds(node, options);
    idMap.set(node.id, remappedNode.id);
    return remappedNode;
  });

  const remappedEdges = sourceEdges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({
      ...cloneValue(edge),
      id: `${edge.id ?? "edge"}-${nanoid(8)}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      selected: false,
      type: edge.type ?? "deletable",
    }));

  return {
    nodes: remappedNodes,
    edges: remappedEdges,
    pastedNodeIds: remappedNodes.map((node) => node.id),
  };
}

export function copyNodesToWorkflowClipboard({
  nodes,
  edges,
  nodeIds,
}: CopyNodesToWorkflowClipboardParams): number {
  const sourceIds = new Set(nodeIds ?? nodes.filter((node) => node.selected).map((node) => node.id));
  const copiedNodes = nodes
    .filter((node) => sourceIds.has(node.id) && node.data?.type !== "start")
    .map(sanitizeNodeForClipboard);

  if (copiedNodes.length === 0) return 0;

  const copiedNodeIds = new Set(copiedNodes.map((node) => node.id));
  const copiedEdges = edges
    .filter((edge) => copiedNodeIds.has(edge.source) && copiedNodeIds.has(edge.target))
    .map(sanitizeEdgeForClipboard);
  const bounds = getSelectionBounds(copiedNodes);

  clipboardSnapshot = {
    nodes: copiedNodes,
    edges: copiedEdges,
    bounds,
    pasteCount: 0,
  };

  return copiedNodes.length;
}

export function hasWorkflowClipboardData(): boolean {
  return !!clipboardSnapshot && clipboardSnapshot.nodes.length > 0;
}

export function pasteNodesFromWorkflowClipboard({
  nodes,
  edges,
  targetPosition,
}: PasteNodesFromWorkflowClipboardParams): PastedWorkflowSelection | null {
  if (!clipboardSnapshot || clipboardSnapshot.nodes.length === 0) return null;

  const pasteCount = clipboardSnapshot.pasteCount + 1;
  const offsetX = targetPosition
    ? targetPosition.x - clipboardSnapshot.bounds.minX
    : PASTE_OFFSET_STEP * pasteCount;
  const offsetY = targetPosition
    ? targetPosition.y - clipboardSnapshot.bounds.minY
    : PASTE_OFFSET_STEP * pasteCount;
  const pasted = remapNodesAndEdges(clipboardSnapshot.nodes, clipboardSnapshot.edges, {
    offsetX,
    offsetY,
    selected: true,
  });

  clipboardSnapshot = {
    ...clipboardSnapshot,
    pasteCount,
  };

  return {
    nodes: [...nodes.map((node) => ({ ...node, selected: false })), ...pasted.nodes],
    edges: [...edges, ...pasted.edges],
    pastedNodeIds: pasted.pastedNodeIds,
  };
}


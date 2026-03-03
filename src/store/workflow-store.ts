import { create } from "zustand";
import { temporal } from "zundo";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Viewport,
} from "@xyflow/react";
import { customAlphabet } from "nanoid";
import type {
  NodeType,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  WorkflowJSON,
} from "@/types/workflow";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import { SubAgentModel, SubAgentMemory } from "@/nodes/sub-agent/enums";
import { createNodeFromType } from "@/lib/node-registry";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

// ── Canvas interaction modes ────────────────────────────────────────────────
export type CanvasMode = "hand" | "selection";
export type EdgeStyle = "bezier" | "smoothstep";

// ── State shape ─────────────────────────────────────────────────────────────
interface WorkflowState {
  // Data
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  // UI
  sidebarOpen: boolean;
  minimapVisible: boolean;
  selectedNodeId: string | null;
  propertiesPanelOpen: boolean;
  viewport: Viewport;
  canvasMode: CanvasMode;
  edgeStyle: EdgeStyle;

  // Delete confirmation
  deleteTarget: { type: "node" | "edge" | "selection"; id: string } | null;

  // React Flow callbacks
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions
  setName: (name: string) => void;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  openPropertiesPanel: (nodeId: string) => void;
  closePropertiesPanel: () => void;
  toggleSidebar: () => void;
  toggleMinimap: () => void;
  setCanvasMode: (mode: CanvasMode) => void;
  toggleEdgeStyle: () => void;
  setViewport: (viewport: Viewport) => void;
  setDeleteTarget: (target: { type: "node" | "edge" | "selection"; id: string } | null) => void;
  confirmDelete: () => void;

  // Multi-select / bulk actions
  duplicateNode: (nodeId: string) => void;
  duplicateSelectedNodes: () => void;
  deleteSelectedNodes: () => void;
  selectAll: () => void;

  // Sub-workflow editing
  activeSubWorkflowNodeId: string | null;
  /** Stack of opened sub-workflow node IDs for nested breadcrumb navigation */
  subWorkflowStack: { nodeId: string; label: string }[];
  /** Nodes currently displayed on the active sub-workflow canvas (set by the canvas component) */
  subWorkflowNodes: WorkflowNode[];
  /** Nodes from the parent context — used to resolve the parent node when opening a nested sub-workflow */
  subWorkflowParentNodes: WorkflowNode[];
  openSubWorkflow: (nodeId: string) => void;
  closeSubWorkflow: () => void;
  /** Navigate back to a specific level in the breadcrumb stack */
  navigateToBreadcrumb: (index: number) => void;
  /** Called by the sub-workflow canvas to register its local nodes so the properties panel can find them */
  setSubWorkflowNodes: (nodes: WorkflowNode[]) => void;
  /** Update node data for a node that lives in the sub-workflow overlay */
  updateSubNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  updateSubWorkflowData: (nodeId: string, subNodes: WorkflowNode[], subEdges: WorkflowEdge[]) => void;
  groupIntoSubWorkflow: (nodeIds: string[]) => void;

  // Persistence
  loadWorkflow: (json: WorkflowJSON) => void;
  getWorkflowJSON: () => WorkflowJSON;
  reset: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────/** The fixed ID used for the mandatory Start node. */
export const START_NODE_ID = "start-default";
/** The fixed ID used for the default End node. */
export const END_NODE_ID = "end-default";

function createDefaultStartNode(): WorkflowNode {
  return {
    ...createNodeFromType("start", { x: 80, y: 200 }),
    id: START_NODE_ID,
    deletable: false,
  } as WorkflowNode;
}

function createDefaultEndNode(): WorkflowNode {
  return {
    ...createNodeFromType("end", { x: 600, y: 200 }),
    id: END_NODE_ID,
  } as WorkflowNode;
}

/** Ensure a workflow's node list always contains the Start node. */
function ensureStartNode(nodes: WorkflowNode[]): WorkflowNode[] {
  const hasStart = nodes.some((n) => n.data?.type === "start");
  return hasStart ? nodes : [createDefaultStartNode(), ...nodes];
}

/** Ensure a workflow's node list always contains at least one End node. */
function ensureEndNode(nodes: WorkflowNode[]): WorkflowNode[] {
  const hasEnd = nodes.some((n) => n.data?.type === "end");
  return hasEnd ? nodes : [...nodes, createDefaultEndNode()];
}

// ── Initial state ───────────────────────────────────────────────────────────

/**
 * Walk the breadcrumb stack from root to resolve the parent context nodes
 * at any given depth. For stack [A, B], to show B's canvas we need A's
 * sub-nodes (because B lives inside A). For stack [A] we need root nodes.
 */
function resolveParentNodes(
  rootNodes: WorkflowNode[],
  stack: { nodeId: string; label: string }[],
): WorkflowNode[] {
  if (stack.length <= 1) return rootNodes;
  // Walk from root through each ancestor, diving into subNodes
  let context: WorkflowNode[] = rootNodes;
  for (let i = 0; i < stack.length - 1; i++) {
    const entry = stack[i];
    const node = context.find((n) => n.id === entry.nodeId);
    const data = node?.data as SubWorkflowNodeData | undefined;
    if (!data?.subNodes) return rootNodes; // fallback
    context = data.subNodes;
  }
  return context;
}

const initialState = {
  name: "Untitled Workflow",
  nodes: [createDefaultStartNode(), createDefaultEndNode()] as WorkflowNode[],
  edges: [] as WorkflowEdge[],
  sidebarOpen: true,
  minimapVisible: true,
  selectedNodeId: null as string | null,
  propertiesPanelOpen: false,
  viewport: { x: 0, y: 0, zoom: 1 },
  canvasMode: "hand" as CanvasMode,
  edgeStyle: "bezier" as EdgeStyle,
  deleteTarget: null as { type: "node" | "edge" | "selection"; id: string } | null,
  activeSubWorkflowNodeId: null as string | null,
  subWorkflowStack: [] as { nodeId: string; label: string }[],
  subWorkflowNodes: [] as WorkflowNode[],
  subWorkflowParentNodes: [] as WorkflowNode[],
};

// ── Store ───────────────────────────────────────────────────────────────────

// Track whether we're in a drag so we can pause/resume temporal tracking
// SAFETY: this is intentionally outside the store closure to avoid re-renders
let _isDragging = false;

export const useWorkflowStore = create<WorkflowState>()(
  temporal(
    (set, get) => ({
  ...initialState,

  // ── React Flow change handlers ──────────────────────────────────────────
  onNodesChange: (changes) => {
    // Check if any change signals the start or end of a node drag
    const hasDragStart = changes.some(
      (c) => c.type === "position" && c.dragging === true
    );
    const hasDragEnd = changes.some(
      (c) => c.type === "position" && c.dragging === false
    );

    // Pause temporal at drag start — this makes all subsequent set() calls
    // skip the expensive partialize + equality + history-push pipeline
    if (hasDragStart && !_isDragging) {
      _isDragging = true;
      useWorkflowStore.temporal.getState().pause();
    }

    // Apply changes normally
    set({ nodes: applyNodeChanges(changes, get().nodes) });

    // Resume temporal at drag end and let the final position be captured
    // in the undo history on the next structural change.
    if (hasDragEnd && _isDragging) {
      _isDragging = false;
      useWorkflowStore.temporal.getState().resume();
    }
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (connection) => {
    // Prevent self-loops
    if (connection.source === connection.target) return;

    const currentNodes = get().nodes;
    const sourceNode = currentNodes.find((n) => n.id === connection.source);
    const targetNode = currentNodes.find((n) => n.id === connection.target);

    // Skill nodes can ONLY connect to agent nodes (as source)
    if (sourceNode?.data?.type === "skill") {
      if (targetNode?.data?.type !== "agent") return;
      // Force the target handle to be the dedicated "skills" handle
      const skillConnection = { ...connection, targetHandle: "skills", type: "deletable" };
      // Multiple skills allowed — no dedup on this handle
      set({ edges: addEdge(skillConnection, get().edges) });
      return;
    }

    // Document nodes can ONLY connect to agent nodes (as source)
    if (sourceNode?.data?.type === "document") {
      if (targetNode?.data?.type !== "agent") return;
      // Force the target handle to be the dedicated "docs" handle
      const docConnection = { ...connection, targetHandle: "docs", type: "deletable" };
      // Multiple docs allowed — no dedup on this handle
      set({ edges: addEdge(docConnection, get().edges) });
      return;
    }

    // No node can connect TO a skill node
    if (targetNode?.data?.type === "skill") return;

    // No node can connect TO a document node
    if (targetNode?.data?.type === "document") return;

    // The "skills" target handle only accepts skill nodes — block everything else
    if (connection.targetHandle === "skills") return;

    // The "docs" target handle only accepts document nodes — block everything else
    if (connection.targetHandle === "docs") return;

    // Each source handle may only connect to one target at a time.
    // Remove any existing edge from the same source handle before adding the new one.
    const filtered = get().edges.filter(
      (e) =>
        !(e.source === connection.source && e.sourceHandle === connection.sourceHandle)
    );
    set({ edges: addEdge({ ...connection, type: "deletable" }, filtered) });
  },

  // ── Actions ─────────────────────────────────────────────────────────────
  setName: (name) => set({ name }),

  addNode: (type, position) => {
    // Only one Start node is allowed and it already exists by default
    if (type === "start") return;
    const newNode = createNodeFromType(type, position) as WorkflowNode;
    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as WorkflowNodeData }
          : node
      ),
    });
  },

  deleteNode: (nodeId) => {
    // The Start node is protected and cannot be deleted
    const target = get().nodes.find((n) => n.id === nodeId);
    if (!target || target.data?.type === "start") return;
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedNodeId:
        get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      propertiesPanelOpen:
        get().selectedNodeId === nodeId ? false : get().propertiesPanelOpen,
    });
  },

  deleteEdge: (edgeId) => {
    set({ edges: get().edges.filter((e) => e.id !== edgeId) });
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  openPropertiesPanel: (nodeId) => {
    set({ selectedNodeId: nodeId, propertiesPanelOpen: true });
  },

  closePropertiesPanel: () => set({ propertiesPanelOpen: false }),

  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),

  toggleMinimap: () => set({ minimapVisible: !get().minimapVisible }),

  setCanvasMode: (mode) => set({ canvasMode: mode }),

  toggleEdgeStyle: () =>
    set({ edgeStyle: get().edgeStyle === "bezier" ? "smoothstep" : "bezier" }),

  setViewport: (viewport) => set({ viewport }),

  setDeleteTarget: (target) => {
    if (target?.type === "node") {
      const node = get().nodes.find((n) => n.id === target.id);
      if (node?.data?.type === "start") return; // Start node is undeletable
    }
    set({ deleteTarget: target });
  },

  confirmDelete: () => {
    const target = get().deleteTarget;
    if (!target) return;
    if (target.type === "node") {
      get().deleteNode(target.id);
    } else if (target.type === "selection") {
      get().deleteSelectedNodes();
    } else {
      get().deleteEdge(target.id);
    }
    set({ deleteTarget: null });
  },

  duplicateNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node || node.data?.type === "start") return;
    const newId = `${node.data.type}-${nanoid(8)}`;
    const newNode: WorkflowNode = {
      ...node,
      id: newId,
      selected: true,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: {
        ...node.data,
        name: newId,
      } as WorkflowNodeData,
    };
    set({
      nodes: [
        ...get().nodes.map((n) => ({ ...n, selected: false })),
        newNode,
      ],
      selectedNodeId: newId,
    });
  },

  duplicateSelectedNodes: () => {
    const toDuplicate = get().nodes.filter(
      (n) => n.selected && n.data?.type !== "start"
    );
    if (toDuplicate.length === 0) return;

    // Build old→new ID map
    const idMap = new Map<string, string>();
    const newNodes: WorkflowNode[] = toDuplicate.map((node) => {
      const newId = `${node.data.type}-${nanoid(8)}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        selected: true,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        data: {
          ...node.data,
          name: newId,
        } as WorkflowNodeData,
      };
    });

    // Duplicate edges whose both endpoints are in the selection
    const newEdges: WorkflowEdge[] = get().edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: `${e.id}-${nanoid(8)}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));

    set({
      nodes: [
        ...get().nodes.map((n) => ({ ...n, selected: false })),
        ...newNodes,
      ],
      edges: [...get().edges, ...newEdges],
    });
  },

  deleteSelectedNodes: () => {
    const selectedIds = get().nodes
      .filter((n) => n.selected && n.data?.type !== "start")
      .map((n) => n.id);
    if (selectedIds.length === 0) return;
    set({
      // Deselect all remaining nodes so the selection box clears
      nodes: get().nodes
        .filter((n) => !selectedIds.includes(n.id))
        .map((n) => ({ ...n, selected: false })),
      edges: get().edges.filter(
        (e) => !selectedIds.includes(e.source) && !selectedIds.includes(e.target)
      ),
      selectedNodeId:
        selectedIds.includes(get().selectedNodeId ?? "") ? null : get().selectedNodeId,
      propertiesPanelOpen:
        selectedIds.includes(get().selectedNodeId ?? "") ? false : get().propertiesPanelOpen,
    });
  },

  selectAll: () => {
    set({
      nodes: get().nodes.map((n) => ({ ...n, selected: true })),
      selectedNodeId: null,
    });
  },

  // ── Sub-workflow editing ────────────────────────────────────────────────
  activeSubWorkflowNodeId: null,
  subWorkflowStack: [],
  subWorkflowNodes: [],
  subWorkflowParentNodes: [],

  openSubWorkflow: (nodeId) => {
    // The "current context" nodes are:
    //   - subWorkflowNodes if already inside a sub-workflow
    //   - nodes (root) if at root level
    const state = get();
    const currentContextNodes = state.activeSubWorkflowNodeId
      ? state.subWorkflowNodes
      : state.nodes;
    const node = currentContextNodes.find((n) => n.id === nodeId);
    const label = (node?.data as SubWorkflowNodeData | undefined)?.label || "Sub Workflow";
    set({
      subWorkflowStack: [...state.subWorkflowStack, { nodeId, label }],
      activeSubWorkflowNodeId: nodeId,
      selectedNodeId: null,
      propertiesPanelOpen: false,
      // Snapshot the current context so the new canvas can find its parent node
      subWorkflowParentNodes: currentContextNodes,
      subWorkflowNodes: [],
    });
  },

  closeSubWorkflow: () => {
    const stack = get().subWorkflowStack;
    if (stack.length <= 1) {
      // Back to root
      set({
        activeSubWorkflowNodeId: null,
        subWorkflowStack: [],
        subWorkflowNodes: [],
        subWorkflowParentNodes: [],
        selectedNodeId: null,
        propertiesPanelOpen: false,
      });
    } else {
      // Pop one level — the parent context becomes the grandparent's sub-workflow
      // We need to find the grandparent's nodes. The grandparent is stack[length-2].
      // To resolve this properly, we look up the grandparent from root nodes recursively.
      const newStack = stack.slice(0, -1);
      const parentContextNodes = resolveParentNodes(get().nodes, newStack);
      set({
        activeSubWorkflowNodeId: newStack[newStack.length - 1].nodeId,
        subWorkflowStack: newStack,
        subWorkflowNodes: [],
        subWorkflowParentNodes: parentContextNodes,
        selectedNodeId: null,
        propertiesPanelOpen: false,
      });
    }
  },

  navigateToBreadcrumb: (index) => {
    if (index < 0) {
      // Navigate to root
      set({
        activeSubWorkflowNodeId: null,
        subWorkflowStack: [],
        subWorkflowNodes: [],
        subWorkflowParentNodes: [],
        selectedNodeId: null,
        propertiesPanelOpen: false,
      });
    } else {
      const newStack = get().subWorkflowStack.slice(0, index + 1);
      const parentContextNodes = resolveParentNodes(get().nodes, newStack);
      set({
        activeSubWorkflowNodeId: newStack[newStack.length - 1].nodeId,
        subWorkflowStack: newStack,
        subWorkflowNodes: [],
        subWorkflowParentNodes: parentContextNodes,
        selectedNodeId: null,
        propertiesPanelOpen: false,
      });
    }
  },

  setSubWorkflowNodes: (nodes) => set({ subWorkflowNodes: nodes }),

  updateSubNodeData: (nodeId, data) => {
    set({
      subWorkflowNodes: get().subWorkflowNodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as WorkflowNodeData }
          : node
      ),
    });
  },

  updateSubWorkflowData: (nodeId, subNodes, subEdges) => {
    const state = get();

    // Helper to update a single node's subNodes/subEdges within a list
    const updateInList = (list: WorkflowNode[]): WorkflowNode[] =>
      list.map((node) => {
        if (node.id !== nodeId) return node;
        const d = node.data as SubWorkflowNodeData;
        return {
          ...node,
          data: { ...d, subNodes, subEdges, nodeCount: subNodes.length } as WorkflowNodeData,
        };
      });

    // Case 1: target node is at the root level (depth-1 sub-workflow)
    if (state.nodes.some((n) => n.id === nodeId)) {
      set({ nodes: updateInList(state.nodes) });
      return;
    }

    // Case 2: target node is in subWorkflowParentNodes (nested sub-workflow)
    if (state.subWorkflowParentNodes.some((n) => n.id === nodeId)) {
      const updatedParentNodes = updateInList(state.subWorkflowParentNodes);
      set({ subWorkflowParentNodes: updatedParentNodes });

      // Propagate the change up to root by rebuilding from root → deepest ancestor.
      // Stack = [A, B, C] means: root contains A, A contains B, B contains C.
      // If C's canvas is editing, parentNodes = B's subNodes (which contains C).
      // We updated B's subNodes (parentNodes). Now embed that into A, then into root.
      const stack = state.subWorkflowStack;
      if (stack.length >= 2) {
        // Walk top-down from root, collect each level's node list
        let rootNodes = [...state.nodes];
        // We need to update from the second-to-last ancestor down to root.
        // stack[0] is in rootNodes, stack[1] is in stack[0]'s subNodes, etc.
        // The parentNodes we just updated belong to stack[stack.length-2]'s subNodes.

        // Rebuild bottom-up: start with the updatedParentNodes and wrap each ancestor
        let currentSubNodes: WorkflowNode[] = updatedParentNodes;
        for (let i = stack.length - 2; i >= 0; i--) {
          const ancestorId = stack[i].nodeId;
          // Resolve the context that CONTAINS this ancestor
          const containingContext = i === 0
            ? rootNodes
            : resolveParentNodes(rootNodes, stack.slice(0, i));
          const ancestorNode = containingContext.find((n) => n.id === ancestorId);
          if (!ancestorNode) break;
          const ancestorData = ancestorNode.data as SubWorkflowNodeData;
          // Update the ancestor's subNodes to currentSubNodes
          const updatedAncestor: WorkflowNode = {
            ...ancestorNode,
            data: {
              ...ancestorData,
              subNodes: currentSubNodes,
              nodeCount: currentSubNodes.length,
            } as WorkflowNodeData,
          };
          if (i === 0) {
            // Ancestor is in root — update root nodes directly
            rootNodes = rootNodes.map((n) => n.id === ancestorId ? updatedAncestor : n);
          } else {
            // Ancestor is nested — we need its parent's subNodes to become currentSubNodes
            // for the next iteration
            currentSubNodes = containingContext.map((n) => n.id === ancestorId ? updatedAncestor : n);
          }
        }
        set({ nodes: rootNodes });
      }
      return;
    }

    // Fallback — search root nodes anyway
    set({ nodes: updateInList(state.nodes) });
  },

  groupIntoSubWorkflow: (nodeIds) => {
    const state = get();
    const selectedNodes = state.nodes.filter((n) => nodeIds.includes(n.id) && n.data?.type !== "start");
    if (selectedNodes.length === 0) return;

    const selectedIdSet = new Set(selectedNodes.map((n) => n.id));

    // Separate internal edges (both endpoints inside) from boundary edges
    const internalEdges = state.edges.filter(
      (e) => selectedIdSet.has(e.source) && selectedIdSet.has(e.target)
    );
    const incomingEdges = state.edges.filter(
      (e) => !selectedIdSet.has(e.source) && selectedIdSet.has(e.target)
    );
    const outgoingEdges = state.edges.filter(
      (e) => selectedIdSet.has(e.source) && !selectedIdSet.has(e.target)
    );

    // Compute centroid for the new sub-workflow node position
    const cx = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
    const cy = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

    // Create embedded start/end nodes for the sub-workflow
    const subStartId = `start-sub-${nanoid(8)}`;
    const subEndId = `end-sub-${nanoid(8)}`;
    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    const maxX = Math.max(...selectedNodes.map((n) => n.position.x));
    const midY = cy;

    const subStartNode: WorkflowNode = {
      id: subStartId,
      type: "start",
      position: { x: minX - 200, y: midY },
      data: { type: "start", label: "Start", name: subStartId } as WorkflowNodeData,
      deletable: false,
    };
    const subEndNode: WorkflowNode = {
      id: subEndId,
      type: "end",
      position: { x: maxX + 200, y: midY },
      data: { type: "end", label: "End", name: subEndId } as WorkflowNodeData,
    };

    // Normalize positions of moved nodes relative to sub-workflow origin
    const offsetX = minX - 100;
    const offsetY = Math.min(...selectedNodes.map((n) => n.position.y)) - 100;
    const subNodes: WorkflowNode[] = [
      subStartNode,
      ...selectedNodes.map((n) => ({
        ...n,
        selected: false,
        position: { x: n.position.x - offsetX, y: n.position.y - offsetY },
      })),
      subEndNode,
    ];

    // Adjust sub start/end positions relative too
    subNodes[0] = { ...subNodes[0], position: { x: subStartNode.position.x - offsetX, y: subStartNode.position.y - offsetY } };
    subNodes[subNodes.length - 1] = { ...subNodes[subNodes.length - 1], position: { x: subEndNode.position.x - offsetX, y: subEndNode.position.y - offsetY } };

    // Build sub-edges: internal + connect sub-start to nodes that had incoming boundary edges,
    // and connect nodes that had outgoing boundary edges to sub-end
    const subEdges: WorkflowEdge[] = [...internalEdges];

    // Connect sub-start → target nodes of incoming edges
    const incomingTargets = new Set(incomingEdges.map((e) => e.target));
    for (const targetId of incomingTargets) {
      subEdges.push({
        id: `e-${subStartId}-${targetId}-${nanoid(4)}`,
        source: subStartId,
        sourceHandle: "output",
        target: targetId,
        targetHandle: "input",
        type: "deletable",
      });
    }

    // Connect source nodes of outgoing edges → sub-end
    const outgoingSources = new Set(outgoingEdges.map((e) => e.source));
    for (const sourceId of outgoingSources) {
      subEdges.push({
        id: `e-${sourceId}-${subEndId}-${nanoid(4)}`,
        source: sourceId,
        sourceHandle: "output",
        target: subEndId,
        targetHandle: "input",
        type: "deletable",
      });
    }

    // Create the sub-workflow node
    const subWorkflowId = `sub-workflow-${nanoid(8)}`;
    const subWorkflowNode: WorkflowNode = {
      id: subWorkflowId,
      type: "sub-workflow",
      position: { x: cx, y: cy },
      selected: false,
      data: {
        type: "sub-workflow",
        label: "Sub Workflow",
        name: subWorkflowId,
        mode: "same-context",
        subNodes,
        subEdges,
        nodeCount: subNodes.length,
        description: "",
        model: SubAgentModel.Inherit,
        memory: SubAgentMemory.Default,
        temperature: 0,
        color: "#a855f7",
        disabledTools: [],
      } as WorkflowNodeData,
    };

    // Remove selected nodes from parent, add sub-workflow node
    const remainingNodes: WorkflowNode[] = [
      ...state.nodes
        .filter((n) => !selectedIdSet.has(n.id))
        .map((n) => ({ ...n, selected: false })),
      subWorkflowNode,
    ];

    // Rewire boundary edges to point to/from the sub-workflow node
    const remainingEdges = state.edges.filter(
      (e) => !selectedIdSet.has(e.source) && !selectedIdSet.has(e.target)
    );
    // Incoming → sub-workflow input
    for (const e of incomingEdges) {
      remainingEdges.push({
        ...e,
        id: `e-${e.source}-${subWorkflowId}-${nanoid(4)}`,
        target: subWorkflowId,
        targetHandle: "input",
        type: "deletable",
      });
    }
    // Sub-workflow output → outgoing targets
    for (const e of outgoingEdges) {
      remainingEdges.push({
        ...e,
        id: `e-${subWorkflowId}-${e.target}-${nanoid(4)}`,
        source: subWorkflowId,
        sourceHandle: "output",
        type: "deletable",
      });
    }

    set({
      nodes: remainingNodes,
      edges: remainingEdges,
      selectedNodeId: subWorkflowId,
      propertiesPanelOpen: true,
    });
  },

  // ── Persistence ─────────────────────────────────────────────────────────
  loadWorkflow: (json) => {
    const nodes = ensureEndNode(
      ensureStartNode(json.nodes).map((n) =>
        n.data?.type === "start" ? { ...n, deletable: false } : n
      ) as WorkflowNode[]
    );
    set({
      name: json.name,
      nodes,
      edges: json.edges.map((e) => ({ ...e, type: "deletable" })),
      sidebarOpen: json.ui.sidebarOpen,
      minimapVisible: json.ui.minimapVisible,
      viewport: json.ui.viewport,
      canvasMode: (json.ui.canvasMode as CanvasMode) ?? "hand",
      edgeStyle: (json.ui.edgeStyle as EdgeStyle) ?? "bezier",
      selectedNodeId: null,
      propertiesPanelOpen: false,
    });
  },

  getWorkflowJSON: (): WorkflowJSON => {
    const state = get();
    return {
      name: state.name,
      nodes: state.nodes,
      edges: state.edges,
      ui: {
        sidebarOpen: state.sidebarOpen,
        minimapVisible: state.minimapVisible,
        viewport: state.viewport,
        canvasMode: state.canvasMode,
        edgeStyle: state.edgeStyle,
      },
    };
  },

  reset: () => set(initialState),
}),
    {
      // Only track data that matters for undo/redo
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        name: state.name,
      }),
      limit: 50,
      // Avoid recording identical states (e.g. viewport-only changes).
      // Shallow reference equality is enough because each mutation produces
      // a fresh arrays/objects. This avoids the expensive JSON.stringify
      // that was running on every position-change frame during a drag.
      equality: (pastState, currentState) =>
        pastState.nodes === currentState.nodes &&
        pastState.edges === currentState.edges &&
        pastState.name === currentState.name,
      // Throttle how often history snapshots are captured so that high-
      // frequency drag moves don't flood the undo stack.
      handleSet: (handleSet) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        return (state) => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            timeoutId = null;
            handleSet(state);
          }, 500);
        };
      },
    },
  ),
);

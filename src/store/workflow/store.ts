import { create } from "zustand";
import { temporal } from "zundo";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Viewport,
} from "@xyflow/react";
import { customAlphabet } from "nanoid";
import {
  NON_DELETABLE_NODE_TYPES,
  WorkflowNodeType,
  type NodeType,
  type WorkflowNode,
  type WorkflowEdge,
  type WorkflowNodeData,
  type WorkflowJSON,
} from "@/types/workflow";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import { SubAgentModel, SubAgentMemory } from "@/nodes/agent/enums";
import { createNodeFromType } from "@/lib/node-registry";
import { usePromptGenStore } from "@/store/prompt-gen";
import { moveNodeIntoSubWorkflowContext } from "@/lib/subworkflow-transfer";
import { normalizeWorkflowConnection } from "@/lib/workflow-connections";
import type { CanvasMode, DeleteTarget, EdgeStyle } from "./types";
import {
  buildWorkflowJson,
  deriveSaveStatus,
  ensureEndNode,
  ensureStartNode,
  getWorkflowFingerprint,
  initialState,
  migrateLegacyPromptScripts,
  PRISTINE_WORKFLOW_FINGERPRINT,
  stripLegacySkillProjectName,
} from "./helpers";
import {
  resolveParentNodes,
  updateNestedSubWorkflowEdges,
  updateNestedSubWorkflowNodes,
} from "./subworkflow";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export type { CanvasMode, DeleteTarget, EdgeStyle } from "./types";

// State shape
interface WorkflowState {
  // Data
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  saveBaselineFingerprint: string;
  librarySavedFingerprint: string | null;
  isDirty: boolean;
  needsSave: boolean;

  // UI
  sidebarOpen: boolean;
  minimapVisible: boolean;
  selectedNodeId: string | null;
  propertiesPanelOpen: boolean;
  viewport: Viewport;
  canvasMode: CanvasMode;
  edgeStyle: EdgeStyle;
  currentDraggedNodeType: NodeType | null;

  // Delete confirmation
  deleteTarget: DeleteTarget | null;

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
  setCurrentDraggedNodeType: (type: NodeType | null) => void;
  setDeleteTarget: (target: DeleteTarget | null) => void;
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
  /** Edges currently displayed on the active sub-workflow canvas */
  subWorkflowEdges: WorkflowEdge[];
  /** Nodes from the parent context — used to resolve the parent node when opening a nested sub-workflow */
  subWorkflowParentNodes: WorkflowNode[];
  openSubWorkflow: (nodeId: string) => void;
  closeSubWorkflow: () => void;
  /** Navigate back to a specific level in the breadcrumb stack */
  navigateToBreadcrumb: (index: number) => void;
  /** Called by the sub-workflow canvas to register its local nodes so the properties panel can find them */
  setSubWorkflowNodes: (nodes: WorkflowNode[]) => void;
  setSubWorkflowEdges: (edges: WorkflowEdge[]) => void;
  /** Update node data for a node that lives in the sub-workflow overlay */
  updateSubNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  deleteSubWorkflowNode: (nodeId: string) => void;
  deleteSelectedSubWorkflowNodes: () => void;
  updateSubWorkflowData: (nodeId: string, subNodes: WorkflowNode[], subEdges: WorkflowEdge[]) => void;
  groupIntoSubWorkflow: (nodeIds: string[]) => void;
  moveNodeIntoSubWorkflow: (sourceNodeId: string, targetSubWorkflowNodeId: string) => boolean;

  // Persistence
  loadWorkflow: (json: WorkflowJSON, options?: { savedToLibrary?: boolean }) => void;
  getWorkflowJSON: () => WorkflowJSON;
  reset: () => void;
  refreshSaveState: (snapshot?: Pick<WorkflowJSON, "name" | "nodes" | "edges">) => void;
  markWorkflowSaved: (snapshot?: Pick<WorkflowJSON, "name" | "nodes" | "edges">) => void;
}

// Store

// Track whether we're in a drag so we can pause/resume temporal tracking
// SAFETY: this is intentionally outside the store closure to avoid re-renders
let _isDragging = false;

export const useWorkflowStore = create<WorkflowState>()(
  temporal(
    (set, get) => ({
  ...initialState,

  // React Flow change handlers
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
    const nextEdges = normalizeWorkflowConnection({
      connection,
      nodes: get().nodes,
      edges: get().edges,
    });
    if (!nextEdges) return;
    set({ edges: nextEdges });
  },

  // Actions
  setName: (name) => set({ name }),

  addNode: (type, position) => {
    // Only one Start node is allowed and it already exists by default
    if (type === WorkflowNodeType.Start) return;
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
    if (!target || NON_DELETABLE_NODE_TYPES.has(target.data?.type ?? WorkflowNodeType.Start)) return;
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
    const state = get();

    if (state.subWorkflowEdges.some((e) => e.id === edgeId)) {
      const nextSubEdges = state.subWorkflowEdges.filter((e) => e.id !== edgeId);
      const stack = state.subWorkflowStack;
      const ancestorPath = stack.slice(0, -1).map((entry) => entry.nodeId);

      set({
        subWorkflowEdges: nextSubEdges,
        nodes:
          ancestorPath.length === 0
            ? state.nodes.map((node) => {
              if (node.id !== state.activeSubWorkflowNodeId || node.data?.type !== WorkflowNodeType.SubWorkflow) return node;
              const data = node.data as SubWorkflowNodeData;
              return {
                ...node,
                data: { ...data, subEdges: nextSubEdges } as WorkflowNodeData,
              };
            })
            : updateNestedSubWorkflowEdges(state.nodes, ancestorPath, nextSubEdges),
      });
      return;
    }

    set({ edges: state.edges.filter((e) => e.id !== edgeId) });
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

  setCurrentDraggedNodeType: (type) => set({ currentDraggedNodeType: type }),

  setDeleteTarget: (target) => {
    if (target?.type === "node") {
      const nodePool = target.scope === "subworkflow" ? get().subWorkflowNodes : get().nodes;
      const node = nodePool.find((n) => n.id === target.id);
      if (node && NON_DELETABLE_NODE_TYPES.has(node.data?.type ?? WorkflowNodeType.Start)) return;
    }
    set({ deleteTarget: target });
  },

  confirmDelete: () => {
    const target = get().deleteTarget;
    if (!target) return;
    if (target.scope === "subworkflow") {
      if (target.type === "node") {
        get().deleteSubWorkflowNode(target.id);
      } else if (target.type === "selection") {
        get().deleteSelectedSubWorkflowNodes();
      } else {
        get().deleteEdge(target.id);
      }
    } else if (target.type === "node") {
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
    if (!node || NON_DELETABLE_NODE_TYPES.has(node.data?.type ?? WorkflowNodeType.Start)) return;
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
      (n) => n.selected && !NON_DELETABLE_NODE_TYPES.has(n.data?.type ?? WorkflowNodeType.Start)
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
      .filter((n) => n.selected && !NON_DELETABLE_NODE_TYPES.has(n.data?.type ?? WorkflowNodeType.Start))
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

  // Sub-workflow editing
  activeSubWorkflowNodeId: null,
  subWorkflowStack: [],
  subWorkflowNodes: [],
  subWorkflowEdges: [],
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
      subWorkflowEdges: [],
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
        subWorkflowEdges: [],
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
        subWorkflowEdges: [],
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
        subWorkflowEdges: [],
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
        subWorkflowEdges: [],
        subWorkflowParentNodes: parentContextNodes,
        selectedNodeId: null,
        propertiesPanelOpen: false,
      });
    }
  },

  setSubWorkflowNodes: (nodes) => set({ subWorkflowNodes: nodes }),

  setSubWorkflowEdges: (edges) => set({ subWorkflowEdges: edges }),

  updateSubNodeData: (nodeId, data) => {
    set({
      subWorkflowNodes: get().subWorkflowNodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as WorkflowNodeData }
          : node
      ),
    });
  },

  deleteSubWorkflowNode: (nodeId) => {
    const state = get();
    const target = state.subWorkflowNodes.find((node) => node.id === nodeId);
    if (!target || NON_DELETABLE_NODE_TYPES.has(target.data?.type ?? WorkflowNodeType.Start)) return;

    const nextNodes = state.subWorkflowNodes.filter((node) => node.id !== nodeId);
    const nextEdges = state.subWorkflowEdges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    );

    set({
      subWorkflowNodes: nextNodes,
      subWorkflowEdges: nextEdges,
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      propertiesPanelOpen: state.selectedNodeId === nodeId ? false : state.propertiesPanelOpen,
    });

    if (state.activeSubWorkflowNodeId) {
      get().updateSubWorkflowData(state.activeSubWorkflowNodeId, nextNodes, nextEdges);
    }
  },

  deleteSelectedSubWorkflowNodes: () => {
    const state = get();
    const selectedIds = state.subWorkflowNodes
      .filter((node) => node.selected && !NON_DELETABLE_NODE_TYPES.has(node.data?.type ?? WorkflowNodeType.Start))
      .map((node) => node.id);
    if (selectedIds.length === 0) return;

    const selectedIdSet = new Set(selectedIds);
    const nextNodes = state.subWorkflowNodes
      .filter((node) => !selectedIdSet.has(node.id))
      .map((node) => ({ ...node, selected: false }));
    const nextEdges = state.subWorkflowEdges.filter(
      (edge) => !selectedIdSet.has(edge.source) && !selectedIdSet.has(edge.target)
    );

    set({
      subWorkflowNodes: nextNodes,
      subWorkflowEdges: nextEdges,
      selectedNodeId: selectedIdSet.has(state.selectedNodeId ?? "") ? null : state.selectedNodeId,
      propertiesPanelOpen: selectedIdSet.has(state.selectedNodeId ?? "") ? false : state.propertiesPanelOpen,
    });

    if (state.activeSubWorkflowNodeId) {
      get().updateSubWorkflowData(state.activeSubWorkflowNodeId, nextNodes, nextEdges);
    }
  },

  updateSubWorkflowData: (nodeId, subNodes, subEdges) => {
    const state = get();

    // Helper to update a single node's subNodes/subEdges within a list
    const updateInList = (list: WorkflowNode[]): WorkflowNode[] =>
      list.map((node) => {
        if (node.id !== nodeId) return node;
        if (node.data?.type !== WorkflowNodeType.SubWorkflow) return node;
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
      const stack = state.subWorkflowStack;
      const ancestorPath = stack.slice(0, -1).map((entry) => entry.nodeId);

      set({
        subWorkflowParentNodes: updatedParentNodes,
        nodes:
          ancestorPath.length === 0
            ? state.nodes
            : updateNestedSubWorkflowNodes(state.nodes, ancestorPath, updatedParentNodes),
      });
      return;
    }

    // Fallback — search root nodes anyway
    set({ nodes: updateInList(state.nodes) });
  },

  groupIntoSubWorkflow: (nodeIds) => {
    const state = get();
    const selectedNodes = state.nodes.filter((n) => nodeIds.includes(n.id) && !NON_DELETABLE_NODE_TYPES.has(n.data?.type ?? WorkflowNodeType.Start));
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
      type: WorkflowNodeType.Start,
      position: { x: 80, y: 200 },
      data: { type: WorkflowNodeType.Start, label: "Start", name: subStartId } as WorkflowNodeData,
      deletable: false,
    };
    const subEndNode: WorkflowNode = {
      id: subEndId,
      type: WorkflowNodeType.End,
      position: { x: maxX + 200, y: midY },
      data: { type: WorkflowNodeType.End, label: "End", name: subEndId } as WorkflowNodeData,
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
      type: WorkflowNodeType.SubWorkflow,
      position: { x: cx, y: cy },
      selected: false,
      data: {
        type: WorkflowNodeType.SubWorkflow,
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

  moveNodeIntoSubWorkflow: (sourceNodeId, targetSubWorkflowNodeId) => {
    const result = moveNodeIntoSubWorkflowContext({
      nodes: get().nodes,
      edges: get().edges,
      sourceNodeId,
      targetSubWorkflowNodeId,
    });

    if (!result.moved) return false;

    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: null,
      propertiesPanelOpen: false,
    });

    return true;
  },

  // Persistence
  loadWorkflow: (json, options) => {
    // Dispose any active AI prompt-generation session from the previous workflow
    usePromptGenStore.getState().disposeSession();

    const savedToLibrary = options?.savedToLibrary ?? false;
    const migrated = migrateLegacyPromptScripts(json.nodes as WorkflowNode[], json.edges as WorkflowEdge[]);
    const normalizedNodes = stripLegacySkillProjectName(migrated.nodes);
    const nodes = ensureEndNode(
      ensureStartNode(normalizedNodes).map((n) =>
        n.data?.type === WorkflowNodeType.Start ? { ...n, deletable: false } : n
      ) as WorkflowNode[]
    );
    const edges = migrated.edges.map((e) => ({ ...e, type: "deletable" }));
    const fingerprint = getWorkflowFingerprint({
      name: json.name,
      nodes,
      edges,
    });
    const librarySavedFingerprint = savedToLibrary ? fingerprint : null;

    set({
      name: json.name,
      nodes,
      edges,
      sidebarOpen: json.ui.sidebarOpen,
      minimapVisible: json.ui.minimapVisible,
      viewport: json.ui.viewport,
      canvasMode: (json.ui.canvasMode as CanvasMode) ?? "hand",
      edgeStyle: (json.ui.edgeStyle as EdgeStyle) ?? "bezier",
      currentDraggedNodeType: null,
      activeSubWorkflowNodeId: null,
      subWorkflowStack: [],
      subWorkflowNodes: [],
      subWorkflowEdges: [],
      subWorkflowParentNodes: [],
      selectedNodeId: null,
      propertiesPanelOpen: false,
      saveBaselineFingerprint: fingerprint,
      librarySavedFingerprint,
        ...deriveSaveStatus(
          fingerprint,
          fingerprint,
          librarySavedFingerprint,
          PRISTINE_WORKFLOW_FINGERPRINT,
        ),
    });
  },

  getWorkflowJSON: (): WorkflowJSON => {
    const state = get();
    return buildWorkflowJson(state);
  },

  refreshSaveState: (snapshot) => {
    const state = get();
    const currentFingerprint = snapshot
      ? getWorkflowFingerprint(snapshot)
      : getWorkflowFingerprint({
          name: state.name,
          nodes: state.nodes,
          edges: state.edges,
        });
    const next = deriveSaveStatus(
      currentFingerprint,
      state.saveBaselineFingerprint,
      state.librarySavedFingerprint,
        PRISTINE_WORKFLOW_FINGERPRINT,
    );

    if (state.isDirty !== next.isDirty || state.needsSave !== next.needsSave) {
      set(next);
    }
  },

  markWorkflowSaved: (snapshot) => {
    const state = get();
    const fingerprint = snapshot
      ? getWorkflowFingerprint(snapshot)
      : getWorkflowFingerprint({
          name: state.name,
          nodes: state.nodes,
          edges: state.edges,
        });

    set({
      saveBaselineFingerprint: fingerprint,
      librarySavedFingerprint: fingerprint,
        ...deriveSaveStatus(
          fingerprint,
          fingerprint,
          fingerprint,
          PRISTINE_WORKFLOW_FINGERPRINT,
        ),
    });
  },

  reset: () => {
    usePromptGenStore.getState().disposeSession();
    set(initialState);
  },
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


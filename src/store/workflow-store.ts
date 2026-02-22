import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Viewport,
} from "@xyflow/react";
import type {
  NodeType,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  WorkflowJSON,
} from "@/types/workflow";
import { createNodeFromType } from "@/lib/node-types";

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

  // Delete confirmation
  deleteTarget: { type: "node" | "edge"; id: string } | null;

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
  setViewport: (viewport: Viewport) => void;
  setDeleteTarget: (target: { type: "node" | "edge"; id: string } | null) => void;
  confirmDelete: () => void;

  // Persistence
  loadWorkflow: (json: WorkflowJSON) => void;
  getWorkflowJSON: () => WorkflowJSON;
  reset: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
/** The fixed ID used for the mandatory Start node. */
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
const initialState = {
  name: "Untitled Workflow",
  nodes: [createDefaultStartNode(), createDefaultEndNode()] as WorkflowNode[],
  edges: [] as WorkflowEdge[],
  sidebarOpen: true,
  minimapVisible: true,
  selectedNodeId: null as string | null,
  propertiesPanelOpen: false,
  viewport: { x: 0, y: 0, zoom: 1 },
  deleteTarget: null as { type: "node" | "edge"; id: string } | null,
};

// ── Store ───────────────────────────────────────────────────────────────────
export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,

  // ── React Flow change handlers ──────────────────────────────────────────
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (connection) => {
    set({ edges: addEdge({ ...connection, type: "smoothstep" }, get().edges) });
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
    } else {
      get().deleteEdge(target.id);
    }
    set({ deleteTarget: null });
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
      edges: json.edges,
      sidebarOpen: json.ui.sidebarOpen,
      minimapVisible: json.ui.minimapVisible,
      viewport: json.ui.viewport,
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
      },
    };
  },

  reset: () => set(initialState),
}));

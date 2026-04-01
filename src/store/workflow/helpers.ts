import type { Viewport } from "@xyflow/react";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowJSON,
  WorkflowNodeData,
} from "@/types/workflow";
import { WorkflowNodeType } from "@/types/workflow";
import type { SubWorkflowNodeData } from "@/nodes/sub-workflow/types";
import {
  stripFingerprintProperties,
  stripTransientProperties,
} from "@/lib/persistence";
import type { CanvasMode, DeleteTarget, EdgeStyle } from "./types";

export const START_NODE_ID = "start-default";
export const END_NODE_ID = "end-default";

export const SAVE_STATUS_UI = {
  sidebarOpen: false,
  minimapVisible: true,
  viewport: { x: 0, y: 0, zoom: 1 } as Viewport,
  canvasMode: "hand" as CanvasMode,
  edgeStyle: "bezier" as EdgeStyle,
};

export function createDefaultStartNode(): WorkflowNode {
  return {
    id: START_NODE_ID,
    type: WorkflowNodeType.Start,
    position: { x: 80, y: 200 },
    data: {
      type: WorkflowNodeType.Start,
      label: "Start",
      name: START_NODE_ID,
    } as WorkflowNodeData,
    deletable: false,
  } as WorkflowNode;
}

export function createDefaultEndNode(): WorkflowNode {
  return {
    id: END_NODE_ID,
    type: WorkflowNodeType.End,
    position: { x: 600, y: 200 },
    data: {
      type: WorkflowNodeType.End,
      label: "END",
      name: END_NODE_ID,
    } as WorkflowNodeData,
  } as WorkflowNode;
}

export function getWorkflowFingerprint(
  snapshot: Pick<WorkflowJSON, "name" | "nodes" | "edges">,
): string {
  const cleaned = stripFingerprintProperties({
    ...snapshot,
    ui: SAVE_STATUS_UI,
  });

  return JSON.stringify({
    name: cleaned.name,
    nodes: cleaned.nodes,
    edges: cleaned.edges,
  });
}

export function deriveSaveStatus(
  currentFingerprint: string,
  baselineFingerprint: string,
  librarySavedFingerprint: string | null,
  pristineWorkflowFingerprint: string,
) {
  const isDirty = currentFingerprint !== baselineFingerprint;
  const needsSave =
    isDirty ||
    (librarySavedFingerprint === null &&
      currentFingerprint !== pristineWorkflowFingerprint);

  return { isDirty, needsSave };
}

export function ensureStartNode(nodes: WorkflowNode[]): WorkflowNode[] {
  const hasStart = nodes.some((node) => node.data?.type === WorkflowNodeType.Start);
  return hasStart ? nodes : [createDefaultStartNode(), ...nodes];
}

export function ensureEndNode(nodes: WorkflowNode[]): WorkflowNode[] {
  const hasEnd = nodes.some((node) => node.data?.type === WorkflowNodeType.End);
  return hasEnd ? nodes : [...nodes, createDefaultEndNode()];
}

export function migrateLegacyPromptScripts(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const legacyScriptIds = new Set(
    edges
      .filter((edge) => edge.targetHandle === "scripts")
      .map((edge) => edge.source),
  );

  const migratedNodes = nodes.map((node) => {
    const data = node.data as WorkflowNodeData;

    if (node.data?.type === WorkflowNodeType.SubWorkflow) {
      const subWorkflowData = data as SubWorkflowNodeData;
      const migratedSub = migrateLegacyPromptScripts(
        subWorkflowData.subNodes ?? [],
        subWorkflowData.subEdges ?? [],
      );
      return {
        ...node,
        data: {
          ...subWorkflowData,
          subNodes: migratedSub.nodes,
          subEdges: migratedSub.edges,
          nodeCount: migratedSub.nodes.length,
        } as WorkflowNodeData,
      };
    }

    if (legacyScriptIds.has(node.id) && node.data?.type === WorkflowNodeType.Prompt) {
      return {
        ...node,
        type: WorkflowNodeType.Script,
        data: {
          ...data,
          type: WorkflowNodeType.Script,
        } as WorkflowNodeData,
      };
    }

    return node;
  });

  const migratedEdges = edges.map((edge) => {
    if (legacyScriptIds.has(edge.source) && edge.targetHandle === "scripts") {
      return {
        ...edge,
        sourceHandle: "script-out",
      };
    }
    return edge;
  });

  return { nodes: migratedNodes, edges: migratedEdges };
}

export function stripLegacySkillProjectName(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  return nodes.map((node) => {
    const data = node.data as WorkflowNodeData;

    if (node.data?.type === WorkflowNodeType.SubWorkflow) {
      const subWorkflowData = data as SubWorkflowNodeData;
      const nextSubNodes = stripLegacySkillProjectName(
        subWorkflowData.subNodes ?? [],
      );
      return {
        ...node,
        data: {
          ...subWorkflowData,
          subNodes: nextSubNodes,
          nodeCount: nextSubNodes.length,
        } as WorkflowNodeData,
      };
    }

    if (node.data?.type !== WorkflowNodeType.Skill) return node;

    const { projectName: _projectName, ...skillData } = data as WorkflowNodeData & {
      projectName?: string;
    };
    return {
      ...node,
      data: skillData as WorkflowNodeData,
    };
  });
}

export const initialWorkflowData = {
  name: "Untitled Workflow",
  nodes: [createDefaultStartNode(), createDefaultEndNode()] as WorkflowNode[],
  edges: [] as WorkflowEdge[],
};

export const PRISTINE_WORKFLOW_FINGERPRINT = getWorkflowFingerprint(
  initialWorkflowData,
);

export const initialState = {
  ...initialWorkflowData,
  sidebarOpen: true,
  minimapVisible: true,
  selectedNodeId: null as string | null,
  propertiesPanelOpen: false,
  viewport: { x: 0, y: 0, zoom: 1 },
  canvasMode: "hand" as CanvasMode,
  edgeStyle: "bezier" as EdgeStyle,
  currentDraggedNodeType: null as WorkflowNodeData["type"] | null,
  deleteTarget: null as DeleteTarget | null,
  activeSubWorkflowNodeId: null as string | null,
  subWorkflowStack: [] as { nodeId: string; label: string }[],
  subWorkflowNodes: [] as WorkflowNode[],
  subWorkflowEdges: [] as WorkflowEdge[],
  subWorkflowParentNodes: [] as WorkflowNode[],
  saveBaselineFingerprint: PRISTINE_WORKFLOW_FINGERPRINT,
  librarySavedFingerprint: null as string | null,
  isDirty: false,
  needsSave: false,
};

export function buildWorkflowJson(state: {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sidebarOpen: boolean;
  minimapVisible: boolean;
  viewport: Viewport;
  canvasMode: CanvasMode;
  edgeStyle: EdgeStyle;
}): WorkflowJSON {
  return stripTransientProperties({
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
  });
}




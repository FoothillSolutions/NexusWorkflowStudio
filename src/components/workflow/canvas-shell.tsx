import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
  ConnectionLineType,
  SelectionMode,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnNodeDrag,
} from "@xyflow/react";
import type { NodeType, WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { Button } from "@/components/ui/button";
import { Map as MapIcon } from "lucide-react";
import {
  BG_CANVAS_HEX,
  CANVAS_DOT_COLOR,
  CANVAS_EDGE_STROKE,
  MINIMAP_MASK_COLOR,
} from "@/lib/theme";
import { NODE_REGISTRY, NODE_TYPE_COMPONENTS } from "@/lib/node-registry";
import { DeletableEdge } from "@/components/edges/deletable-edge";
import type { CanvasMode, EdgeStyle } from "@/store/workflow-store";

const EDGE_TYPE_COMPONENTS: EdgeTypes = { deletable: DeletableEdge };
const MIN_CANVAS_ZOOM = 0.1;

interface CanvasShellProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onNodeClick: (event: React.MouseEvent, node: { id: string }) => void;
  onNodeDoubleClick: (event: React.MouseEvent, node: { id: string }) => void;
  onNodeDragStart?: OnNodeDrag<WorkflowNode>;
  onNodeDrag?: OnNodeDrag<WorkflowNode>;
  onNodeDragStop?: OnNodeDrag<WorkflowNode>;
  onPaneClick: () => void;
  onMoveEnd?: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
  onNodeContextMenu: (event: React.MouseEvent, node: { id: string; data?: { type?: string } }) => void;
  onSelectionContextMenu: (event: React.MouseEvent) => void;
  onPaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;
  onEdgeClick?: () => void;
  canvasMode: CanvasMode;
  edgeStyle: EdgeStyle;
  minimapVisible: boolean;
  toggleMinimap: () => void;
  isDragging: boolean;
  fitViewOnInit?: boolean;
  children?: React.ReactNode;
}

/**
 * Shared ReactFlow canvas shell — encapsulates common config, background,
 * minimap, and static memoized props used by both root and sub-workflow canvases.
 */
export function CanvasShell({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDrop,
  onDragOver,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onPaneClick,
  onMoveEnd,
  onNodeContextMenu,
  onSelectionContextMenu,
  onPaneContextMenu,
  onEdgeClick,
  canvasMode,
  edgeStyle,
  minimapVisible,
  toggleMinimap,
  isDragging,
  fitViewOnInit = true,
  children,
}: CanvasShellProps) {
  const { getViewport, setCenter } = useReactFlow<WorkflowNode, WorkflowEdge>();
  const nodeTypes: NodeTypes = useMemo(() => NODE_TYPE_COMPONENTS, []);
  const edgeTypes: EdgeTypes = useMemo(() => EDGE_TYPE_COMPONENTS, []);

  const connectionLineType =
    edgeStyle === "smoothstep" ? ConnectionLineType.SmoothStep : ConnectionLineType.Bezier;

  const connectionLineStyle = useMemo(
    () => ({ stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 }),
    []
  );
  const defaultEdgeOptions = useMemo(
    () => ({ type: "deletable" as const, style: { stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 }, animated: false }),
    []
  );
  const fitViewOptions = useMemo(() => ({ maxZoom: 0.85, padding: 0.3 }), []);
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const rfStyle = useMemo(() => ({ backgroundColor: BG_CANVAS_HEX }), []);
  const panOnDrag = useMemo(
    () => (canvasMode === "hand" ? [0, 1, 2] : [1, 2]),
    [canvasMode]
  );
  const minimapNodeColor = useCallback(
    (node: { type?: string }) => NODE_REGISTRY[node.type as NodeType]?.accentHex ?? "#52525b",
    []
  );
  const handleMinimapClick = useCallback(
    (_event: React.MouseEvent<Element>, position: { x: number; y: number }) => {
      void setCenter(position.x, position.y, {
        zoom: getViewport().zoom,
        duration: 150,
      });
    },
    [getViewport, setCenter]
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        deleteKeyCode={null}
        connectionLineType={connectionLineType}
        connectionLineStyle={connectionLineStyle}
        minZoom={MIN_CANVAS_ZOOM}
        fitView={fitViewOnInit}
        fitViewOptions={fitViewOptions}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={proOptions}
        style={rfStyle}
        selectionOnDrag={canvasMode === "selection"}
        selectionMode={SelectionMode.Partial}
        panOnDrag={panOnDrag}
        panOnScroll={false}
        nodesDraggable={true}
      >
        <Background variant={BackgroundVariant.Dots} color={CANVAS_DOT_COLOR} gap={20} size={1} />
        {minimapVisible && !isDragging && (
          <MiniMap
            className="bg-zinc-900! border-zinc-700!"
            nodeColor={minimapNodeColor}
            maskColor={MINIMAP_MASK_COLOR}
            pannable
            onClick={handleMinimapClick}
          />
        )}
      </ReactFlow>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMinimap}
        className="absolute bottom-4 right-4 z-10 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 h-8 w-8"
        title={minimapVisible ? "Hide Minimap" : "Show Minimap"}
      >
        <MapIcon size={16} />
      </Button>

      {children}
    </>
  );
}


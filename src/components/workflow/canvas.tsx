"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  ConnectionLineType,
} from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";
import type { NodeType } from "@/types/workflow";
import { Button } from "@/components/ui/button";
import { Map } from "lucide-react";
import {
  BG_CANVAS_HEX,
  CANVAS_DOT_COLOR,
  CANVAS_EDGE_STROKE,
  MINIMAP_MASK_COLOR,
} from "@/lib/theme";
import { NODE_REGISTRY } from "@/lib/node-types";

// Node components
import { StartNode } from "@/components/nodes/start-node";
import { PromptNode } from "@/components/nodes/prompt-node";
import { SubAgentNode } from "@/components/nodes/sub-agent-node";
import { SubAgentFlowNode } from "@/components/nodes/sub-agent-flow-node";
import { SkillNode } from "@/components/nodes/skill-node";
import { McpToolNode } from "@/components/nodes/mcp-tool-node";
import { IfElseNode } from "@/components/nodes/if-else-node";
import { SwitchNode } from "@/components/nodes/switch-node";
import { AskUserNode } from "@/components/nodes/ask-user-node";
import { EndNode } from "@/components/nodes/end-node";
import { DeletableEdge } from "@/components/edges/deletable-edge";

const nodeTypeComponents: NodeTypes = {
  start: StartNode,
  prompt: PromptNode,
  "sub-agent": SubAgentNode,
  "sub-agent-flow": SubAgentFlowNode,
  skill: SkillNode,
  "mcp-tool": McpToolNode,
  "if-else": IfElseNode,
  switch: SwitchNode,
  "ask-user": AskUserNode,
  end: EndNode,
};

const edgeTypeComponents: EdgeTypes = {
  deletable: DeletableEdge,
};

export default function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
    openPropertiesPanel,
    setViewport,
    minimapVisible,
    toggleMinimap,
  } = useWorkflowStore();

  const { screenToFlowPosition } = useReactFlow();

  // Memoize nodeTypes to prevent re-renders
  const nodeTypes = useMemo(() => nodeTypeComponents, []);
  const edgeTypes = useMemo(() => edgeTypeComponents, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type as NodeType, position);
    },
    [screenToFlowPosition, addNode]
  );

  return (
    <div className="w-full h-full relative">
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
        onNodeDoubleClick={(_, node) => openPropertiesPanel(node.id)}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={() => selectNode(null)}
        onPaneClick={() => selectNode(null)}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        deleteKeyCode={null}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: CANVAS_EDGE_STROKE, strokeWidth: 4}}
        fitView
        defaultEdgeOptions={{
          type: "deletable",
          style: { stroke: CANVAS_EDGE_STROKE, strokeWidth: 4 },
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: BG_CANVAS_HEX }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color={CANVAS_DOT_COLOR}
          gap={20}
          size={1}
        />
        <Controls className="!bg-zinc-800 !border-zinc-700 !shadow-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-300 [&>button:hover]:!bg-zinc-700" />
        {minimapVisible && (
          <MiniMap
            className="!bg-zinc-900 !border-zinc-700"
            nodeColor={(node) =>
              NODE_REGISTRY[node.type as NodeType]?.accentHex ?? "#52525b"
            }
            maskColor={MINIMAP_MASK_COLOR}
          />
        )}
      </ReactFlow>

      {/* Minimap toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMinimap}
        className="absolute bottom-4 right-4 z-10 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 h-8 w-8"
        title={minimapVisible ? "Hide Minimap" : "Show Minimap"}
      >
        <Map size={16} />
      </Button>
    </div>
  );
}

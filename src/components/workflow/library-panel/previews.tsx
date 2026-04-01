import { BG_CANVAS_HEX, TEXT_SUBTLE } from "@/lib/theme";
import { NODE_REGISTRY } from "@/lib/node-registry";
import type { NodeType } from "@/types/workflow";
import type { LibraryItemEntry, SavedWorkflowEntry } from "@/lib/library";

export function WorkflowMiniMap({ entry }: { entry: SavedWorkflowEntry }) {
  const nodes = entry.workflow.nodes;
  const edges = entry.workflow.edges;

  if (nodes.length === 0) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-t-lg bg-zinc-950">
        <span className={`text-xs ${TEXT_SUBTLE}`}>Empty workflow</span>
      </div>
    );
  }

  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const NODE_WIDTH = 160;
  const NODE_HEIGHT = 40;
  const contentWidth = maxX - minX + NODE_WIDTH;
  const contentHeight = maxY - minY + NODE_HEIGHT;

  const svgWidth = 280;
  const svgHeight = 96;
  const padding = 14;

  const scaleX = (svgWidth - padding * 2) / Math.max(contentWidth, 1);
  const scaleY = (svgHeight - padding * 2) / Math.max(contentHeight, 1);
  const scale = Math.min(scaleX, scaleY, 1.5);

  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;
  const offsetX = (svgWidth - scaledWidth) / 2;
  const offsetY = (svgHeight - scaledHeight) / 2;

  const toX = (x: number) => (x - minX) * scale + offsetX;
  const toY = (y: number) => (y - minY) * scale + offsetY;

  const nodeWidth = Math.max(NODE_WIDTH * scale * 0.6, 20);
  const nodeHeight = Math.max(NODE_HEIGHT * scale * 0.5, 8);

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return (
    <svg
      width="100%"
      height="96"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="rounded-xl"
      style={{ backgroundColor: BG_CANVAS_HEX }}
    >
      {edges.map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) return null;

        return (
          <line
            key={edge.id}
            x1={toX(sourceNode.position.x) + nodeWidth / 2}
            y1={toY(sourceNode.position.y) + nodeHeight / 2}
            x2={toX(targetNode.position.x) + nodeWidth / 2}
            y2={toY(targetNode.position.y) + nodeHeight / 2}
            stroke="#444"
            strokeWidth={1.5}
            opacity={0.6}
          />
        );
      })}
      {nodes.map((node) => {
        const nodeType = (node.data?.type ?? node.type) as NodeType;
        const color = NODE_REGISTRY[nodeType]?.accentHex ?? "#52525b";

        return (
          <rect
            key={node.id}
            x={toX(node.position.x)}
            y={toY(node.position.y)}
            width={nodeWidth}
            height={nodeHeight}
            rx={3}
            fill={color}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

export function NodePreview({ item }: { item: LibraryItemEntry }) {
  const registryEntry = NODE_REGISTRY[item.nodeType];
  const Icon = registryEntry?.icon;
  const accentHex = registryEntry?.accentHex ?? "#52525b";

  return (
    <div
      className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl"
      style={{ backgroundColor: BG_CANVAS_HEX }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(ellipse at center, ${accentHex} 0%, transparent 70%)`,
        }}
      />
      <div
        className="relative flex max-w-[85%] items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.18)]"
        style={{
          backgroundColor: `${accentHex}15`,
          borderColor: `${accentHex}40`,
        }}
      >
        {Icon && <Icon size={15} style={{ color: accentHex }} />}
        <span className="max-w-full truncate text-xs font-medium text-zinc-300 sm:text-sm">
          {item.name}
        </span>
      </div>
    </div>
  );
}


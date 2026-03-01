import type { NodeType, WorkflowNode, WorkflowEdge } from "@/types/workflow";
import type { SubAgentModel, SubAgentMemory } from "@/nodes/sub-agent/enums";

export type SubWorkflowMode = "same-context" | "agent";

export interface SubWorkflowNodeData extends Record<string, unknown> {
  type: Extract<NodeType, "sub-workflow">;
  label: string;
  name: string;
  /** Execution mode — inline (same context) or delegated to a spawned agent */
  mode: SubWorkflowMode;
  /** Embedded nodes of the sub-workflow */
  subNodes: WorkflowNode[];
  /** Embedded edges of the sub-workflow */
  subEdges: WorkflowEdge[];
  /** Derived count of inner nodes (readonly in the UI) */
  nodeCount: number;

  // ── Agent-mode fields (only used when mode === "agent") ──────────────
  description: string;
  model: SubAgentModel;
  memory: SubAgentMemory;
  temperature: number;
  color: string;
  /** Tool names that are DISABLED (empty = all enabled) */
  disabledTools: string[];
}


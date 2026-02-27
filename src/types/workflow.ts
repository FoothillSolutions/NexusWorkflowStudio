import type { Node, Edge, Viewport } from "@xyflow/react";

// ── Agent enums (canonical source: @/nodes/sub-agent/enums) ────────────
export { SubAgentModel, SubAgentMemory, MODEL_DISPLAY_NAMES } from "@/nodes/sub-agent/enums";
import { SubAgentModel, SubAgentMemory } from "@/nodes/sub-agent/enums";

// ── Node Types ──────────────────────────────────────────────────────────────
export const NODE_TYPES = [
  "start",
  "prompt",
  "agent",
  "sub-workflow",
  "skill",
  "mcp-tool",
  "if-else",
  "switch",
  "ask-user",
  "end",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

// ── Per-type data payloads ──────────────────────────────────────────────────
interface BaseNodeData extends Record<string, unknown> {
  type: NodeType;
  label: string;
  name: string;
}

export interface StartNodeData extends BaseNodeData {
  type: "start";
}

export interface PromptNodeData extends BaseNodeData {
  type: "prompt";
  promptText: string;
  detectedVariables: string[];
}

export interface SubAgentNodeData extends BaseNodeData {
  type: "agent";
  description: string;
  promptText: string;
  detectedVariables: string[];
  model: SubAgentModel;
  memory: SubAgentMemory;
  temperature: number;
  color: string;
  /** Tool names that are DISABLED (empty = all enabled) */
  disabledTools: string[];
  /** Positional parameter mappings passed to the delegated agent */
  parameterMappings: string[];
}

export interface SubAgentFlowNodeData extends BaseNodeData {
  type: "sub-workflow";
  flowRef: string;
  nodeCount: number;
}

export interface SkillNodeData extends BaseNodeData {
  type: "skill";
  skillName: string;
  projectName: string;
  description: string;
  promptText: string;
  detectedVariables: string[];
  metadata: Array<{ key: string; value: string }>;
}

export interface McpToolNodeData extends BaseNodeData {
  type: "mcp-tool";
  toolName: string;
  paramsText: string;
}

export interface IfElseBranch {
  label: string;
  condition: string;
}

export interface IfElseNodeData extends BaseNodeData {
  type: "if-else";
  evaluationTarget: string;
  branches: IfElseBranch[];
}

export interface SwitchNodeData extends BaseNodeData {
  type: "switch";
  switchExpr: string;
  cases: string[];
}

export interface AskUserNodeData extends BaseNodeData {
  type: "ask-user";
  questionText: string;
  options: string[];
}

export interface EndNodeData extends BaseNodeData {
  type: "end";
}

// ── Discriminated union ─────────────────────────────────────────────────────
export type WorkflowNodeData =
  | StartNodeData
  | PromptNodeData
  | SubAgentNodeData
  | SubAgentFlowNodeData
  | SkillNodeData
  | McpToolNodeData
  | IfElseNodeData
  | SwitchNodeData
  | AskUserNodeData
  | EndNodeData;

// ── React Flow typed aliases ────────────────────────────────────────────────
export type WorkflowNode = Node<WorkflowNodeData, string>;
export type WorkflowEdge = Edge;

// ── Persisted JSON shape ────────────────────────────────────────────────────
export interface WorkflowJSON {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  ui: {
    sidebarOpen: boolean;
    minimapVisible: boolean;
    viewport: Viewport;
  };
}

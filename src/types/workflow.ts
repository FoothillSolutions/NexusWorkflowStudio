import type { Node, Edge, Viewport } from "@xyflow/react";

// ── Agent enums (canonical source: @/nodes/agent/enums)
export { SubAgentModel, SubAgentMemory, MODEL_DISPLAY_NAMES } from "@/nodes/agent/enums";
import { SubAgentMemory } from "@/nodes/agent/enums";

// Node Types
export const NODE_TYPES = [
  "start",
  "prompt",
  "script",
  "agent",
  "parallel-agent",
  "sub-workflow",
  "skill",
  "document",
  "mcp-tool",
  "if-else",
  "switch",
  "ask-user",
  "end",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

// Per-type data payloads
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

export interface ScriptNodeData extends BaseNodeData {
  type: "script";
  promptText: string;
  detectedVariables: string[];
}

export interface SubAgentNodeData extends BaseNodeData {
  type: "agent";
  description: string;
  promptText: string;
  detectedVariables: string[];
  model: string;
  memory: SubAgentMemory;
  temperature: number;
  color: string;
  /** Tool names that are DISABLED (empty = all enabled) */
  disabledTools: string[];
  /** Positional parameter mappings passed to the delegated agent */
  parameterMappings: string[];
  /** Static variable mappings: {{varName}} → resource ref (e.g. "doc:product/api-guide.md", "skill:my-skill") */
  variableMappings: Record<string, string>;
}

export interface ParallelAgentBranch {
  label: string;
  instructions: string;
  spawnCount: number;
}

export interface ParallelAgentNodeData extends BaseNodeData {
  type: "parallel-agent";
  sharedInstructions: string;
  branches: ParallelAgentBranch[];
}

export type SubWorkflowMode = "same-context" | "agent";

export interface SubWorkflowNodeData extends BaseNodeData {
  type: "sub-workflow";
  mode: SubWorkflowMode;
  subNodes: WorkflowNode[];
  subEdges: WorkflowEdge[];
  nodeCount: number;
  // Agent-mode fields
  description: string;
  model: string;
  memory: SubAgentMemory;
  temperature: number;
  color: string;
  disabledTools: string[];
}

export interface SkillNodeData extends BaseNodeData {
  type: "skill";
  skillName: string;
  description: string;
  promptText: string;
  detectedVariables: string[];
  /** Static variable mappings: {{varName}} → script ref (e.g. "script:lint-fix.ts") */
  variableMappings: Record<string, string>;
  metadata: Array<{ key: string; value: string }>;
}

export type DocumentContentMode = "inline" | "linked";

export interface DocumentNodeData extends BaseNodeData {
  type: "document";
  docName: string;
  docSubfolder: string;
  contentMode: DocumentContentMode;
  /** The file extension for the document (md, txt, json, yaml) */
  fileExtension: "md" | "txt" | "json" | "yaml";
  /** Inline content entered by the user */
  contentText: string;
  /** File name of the linked/uploaded file */
  linkedFileName: string;
  /** Raw content of the linked/uploaded file */
  linkedFileContent: string;
  description: string;
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

export interface SwitchBranch {
  label: string;
  condition: string;
}

export interface SwitchNodeData extends BaseNodeData {
  type: "switch";
  evaluationTarget: string;
  branches: SwitchBranch[];
}

export interface AskUserOption {
  label: string;
  description: string;
}

export interface AskUserNodeData extends BaseNodeData {
  type: "ask-user";
  questionText: string;
  multipleSelection: boolean;
  aiSuggestOptions: boolean;
  options: AskUserOption[];
}

export interface EndNodeData extends BaseNodeData {
  type: "end";
}

// Discriminated union
export type WorkflowNodeData =
  | StartNodeData
  | PromptNodeData
  | ScriptNodeData
  | SubAgentNodeData
  | ParallelAgentNodeData
  | SubWorkflowNodeData
  | SkillNodeData
  | DocumentNodeData
  | McpToolNodeData
  | IfElseNodeData
  | SwitchNodeData
  | AskUserNodeData
  | EndNodeData;

// React Flow typed aliases
export type WorkflowNode = Node<WorkflowNodeData, string>;
export type WorkflowEdge = Edge;

// Persisted JSON shape
export interface WorkflowJSON {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  ui: {
    sidebarOpen: boolean;
    minimapVisible: boolean;
    viewport: Viewport;
    canvasMode?: string;
    edgeStyle?: string;
  };
}

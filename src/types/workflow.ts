import type { Node, Edge, Viewport } from "@xyflow/react";

export { SubAgentModel, SubAgentMemory, MODEL_DISPLAY_NAMES } from "@/nodes/agent/enums";
import { SubAgentMemory } from "@/nodes/agent/enums";
import { WorkflowNodeType, type NodeType } from "./node-types";
export {
  AGENT_LIKE_NODE_TYPES,
  ATTACHMENT_NODE_TYPES,
  BRANCHING_NODE_TYPES,
  LIBRARY_SAVEABLE_NODE_TYPES,
  NODE_TYPES,
  NON_DELETABLE_NODE_TYPES,
  WorkflowNodeType,
} from "./node-types";
export type { NodeType } from "./node-types";

// Per-type data payloads
interface BaseNodeData extends Record<string, unknown> {
  type: NodeType;
  label: string;
  name: string;
}

export interface StartNodeData extends BaseNodeData {
  type: WorkflowNodeType.Start;
}

export interface PromptNodeData extends BaseNodeData {
  type: WorkflowNodeType.Prompt;
  promptText: string;
  detectedVariables: string[];
}

export interface ScriptNodeData extends BaseNodeData {
  type: WorkflowNodeType.Script;
  promptText: string;
  detectedVariables: string[];
}

export interface SubAgentNodeData extends BaseNodeData {
  type: WorkflowNodeType.Agent;
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
  type: WorkflowNodeType.ParallelAgent;
  sharedInstructions: string;
  branches: ParallelAgentBranch[];
}

export type SubWorkflowMode = "same-context" | "agent";

export interface SubWorkflowNodeData extends BaseNodeData {
  type: WorkflowNodeType.SubWorkflow;
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
  type: WorkflowNodeType.Skill;
  skillName: string;
  description: string;
  promptText: string;
  detectedVariables: string[];
  /** Static variable mappings: {{varName}} → script ref (e.g. "script:lint-fix.ts") */
  variableMappings: Record<string, string>;
  metadata: Array<{ key: string; value: string }>;
}

export type DocumentContentMode = "inline" | "linked" | "brain";

export interface DocumentNodeData extends BaseNodeData {
  type: WorkflowNodeType.Document;
  docName: string;
  docSubfolder: string;
  contentMode: DocumentContentMode;
  /** The file extension for the document (md, txt, json, yaml) */
  fileExtension: "md" | "txt" | "json" | "yaml";
  /** Inline content entered by the user */
  contentText: string;
  /** File name of the linked/uploaded file */
  linkedFileName: string | null;
  /** Raw content of the linked/uploaded file */
  linkedFileContent: string | null;
  description: string;
  /** Brain doc ID when contentMode is "brain" */
  brainDocId: string | null;
}

export interface McpToolNodeData extends BaseNodeData {
  type: WorkflowNodeType.McpTool;
  toolName: string;
  paramsText: string;
}

export interface IfElseBranch {
  label: string;
  condition: string;
}

export interface IfElseNodeData extends BaseNodeData {
  type: WorkflowNodeType.IfElse;
  evaluationTarget: string;
  branches: IfElseBranch[];
}

export interface SwitchBranch {
  id?: string;
  label: string;
  condition: string;
}

export interface SwitchNodeData extends BaseNodeData {
  type: WorkflowNodeType.Switch;
  evaluationTarget: string;
  branches: SwitchBranch[];
}

export interface AskUserOption {
  label: string;
  description: string;
}

export interface AskUserNodeData extends BaseNodeData {
  type: WorkflowNodeType.AskUser;
  questionText: string;
  multipleSelection: boolean;
  aiSuggestOptions: boolean;
  options: AskUserOption[];
}

export interface EndNodeData extends BaseNodeData {
  type: WorkflowNodeType.End;
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

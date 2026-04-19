export enum WorkflowNodeType {
  Start = "start",
  Prompt = "prompt",
  Script = "script",
  Agent = "agent",
  ParallelAgent = "parallel-agent",
  SubWorkflow = "sub-workflow",
  Skill = "skill",
  Document = "document",
  McpTool = "mcp-tool",
  Handoff = "handoff",
  IfElse = "if-else",
  Switch = "switch",
  AskUser = "ask-user",
  End = "end",
}

export type NodeType = `${WorkflowNodeType}`;

export const NODE_TYPES = Object.values(WorkflowNodeType) as readonly NodeType[];

export const NON_DELETABLE_NODE_TYPES = new Set<NodeType>([WorkflowNodeType.Start]);

export const LIBRARY_SAVEABLE_NODE_TYPES = new Set<NodeType>([
  WorkflowNodeType.Agent,
  WorkflowNodeType.Skill,
  WorkflowNodeType.Document,
  WorkflowNodeType.Prompt,
  WorkflowNodeType.Script,
]);

export const AGENT_LIKE_NODE_TYPES = new Set<NodeType>([
  WorkflowNodeType.Agent,
  WorkflowNodeType.ParallelAgent,
]);

export const ATTACHMENT_NODE_TYPES = new Set<NodeType>([
  WorkflowNodeType.Skill,
  WorkflowNodeType.Document,
]);

export const BRANCHING_NODE_TYPES = new Set<NodeType>([
  WorkflowNodeType.IfElse,
  WorkflowNodeType.Switch,
  WorkflowNodeType.ParallelAgent,
  WorkflowNodeType.AskUser,
]);


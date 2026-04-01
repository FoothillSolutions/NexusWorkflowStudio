/**
 * node-registry.ts
 *
 * Thin aggregator that imports all node modules and assembles the
 * canonical NODE_REGISTRY, NODE_TYPE_COMPONENTS map, nodeSchemaMap,
 * and palette helpers used throughout the app.
 */

import type { NodeTypes } from "@xyflow/react";
import { WorkflowNodeType, type NodeType } from "@/types/workflow";
import { customAlphabet } from "nanoid";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";

// Node module imports
import { startRegistryEntry, startSchema, StartNode } from "@/nodes/start";
import { endRegistryEntry, endSchema, EndNode } from "@/nodes/end";
import { promptRegistryEntry, promptSchema, PromptNode } from "@/nodes/prompt";
import { scriptRegistryEntry, scriptSchema, ScriptNode } from "@/nodes/script";
import { subAgentRegistryEntry, subAgentSchema, SubAgentNode } from "@/nodes/agent";
import { parallelAgentRegistryEntry, parallelAgentSchema, ParallelAgentNode } from "@/nodes/parallel-agent";
import { subWorkflowRegistryEntry, subWorkflowSchema, SubWorkflowNode } from "@/nodes/sub-workflow";
import { skillRegistryEntry, skillSchema, SkillNode } from "@/nodes/skill";
import { documentRegistryEntry, documentSchema, DocumentNode } from "@/nodes/document";
import { mcpToolRegistryEntry, mcpToolSchema, McpToolNode } from "@/nodes/mcp-tool";
import { ifElseRegistryEntry, ifElseSchema, IfElseNode } from "@/nodes/if-else";
import { switchRegistryEntry, switchSchema, SwitchNode } from "@/nodes/switch";
import { askUserRegistryEntry, askUserSchema, AskUserNode } from "@/nodes/ask-user";

// Registry
export const NODE_REGISTRY: Record<NodeType, NodeRegistryEntry> = {
  [WorkflowNodeType.Start]: startRegistryEntry,
  [WorkflowNodeType.End]: endRegistryEntry,
  [WorkflowNodeType.Prompt]: promptRegistryEntry,
  [WorkflowNodeType.Script]: scriptRegistryEntry,
  [WorkflowNodeType.Agent]: subAgentRegistryEntry,
  [WorkflowNodeType.ParallelAgent]: parallelAgentRegistryEntry,
  [WorkflowNodeType.Skill]: skillRegistryEntry,
  [WorkflowNodeType.Document]: documentRegistryEntry,
  [WorkflowNodeType.SubWorkflow]: subWorkflowRegistryEntry,
  [WorkflowNodeType.McpTool]: mcpToolRegistryEntry,
  [WorkflowNodeType.IfElse]: ifElseRegistryEntry,
  [WorkflowNodeType.Switch]: switchRegistryEntry,
  [WorkflowNodeType.AskUser]: askUserRegistryEntry,
};

// React Flow node type → component map
export const NODE_TYPE_COMPONENTS: NodeTypes = {
  [WorkflowNodeType.Start]: StartNode,
  [WorkflowNodeType.End]: EndNode,
  [WorkflowNodeType.Prompt]: PromptNode,
  [WorkflowNodeType.Script]: ScriptNode,
  [WorkflowNodeType.Agent]: SubAgentNode,
  [WorkflowNodeType.ParallelAgent]: ParallelAgentNode,
  [WorkflowNodeType.SubWorkflow]: SubWorkflowNode,
  [WorkflowNodeType.Skill]: SkillNode,
  [WorkflowNodeType.Document]: DocumentNode,
  [WorkflowNodeType.McpTool]: McpToolNode,
  [WorkflowNodeType.IfElse]: IfElseNode,
  [WorkflowNodeType.Switch]: SwitchNode,
  [WorkflowNodeType.AskUser]: AskUserNode,
};

// Schema map
export const nodeSchemaMap = {
  [WorkflowNodeType.Start]: startSchema,
  [WorkflowNodeType.End]: endSchema,
  [WorkflowNodeType.Prompt]: promptSchema,
  [WorkflowNodeType.Script]: scriptSchema,
  [WorkflowNodeType.Agent]: subAgentSchema,
  [WorkflowNodeType.ParallelAgent]: parallelAgentSchema,
  [WorkflowNodeType.SubWorkflow]: subWorkflowSchema,
  [WorkflowNodeType.Skill]: skillSchema,
  [WorkflowNodeType.Document]: documentSchema,
  [WorkflowNodeType.McpTool]: mcpToolSchema,
  [WorkflowNodeType.IfElse]: ifElseSchema,
  [WorkflowNodeType.Switch]: switchSchema,
  [WorkflowNodeType.AskUser]: askUserSchema,
} as const;

// Palette groupings
const BASIC_NODE_ORDER: NodeType[] = [
  WorkflowNodeType.Start,
  WorkflowNodeType.Prompt,
  WorkflowNodeType.Agent,
  WorkflowNodeType.Skill,
  WorkflowNodeType.Document,
  WorkflowNodeType.Script,
  WorkflowNodeType.SubWorkflow,
  WorkflowNodeType.McpTool,
];

const CONTROL_FLOW_NODE_ORDER: NodeType[] = [
  WorkflowNodeType.IfElse,
  WorkflowNodeType.Switch,
  WorkflowNodeType.ParallelAgent,
  WorkflowNodeType.AskUser,
  WorkflowNodeType.End,
];

export const BASIC_NODES = BASIC_NODE_ORDER.map((type) => NODE_REGISTRY[type]).filter(
  (n) => n.category === NodeCategory.Basic,
);
export const CONTROL_FLOW_NODES = CONTROL_FLOW_NODE_ORDER.map((type) => NODE_REGISTRY[type]).filter(
  (n) => n.category === NodeCategory.ControlFlow,
);

// Node creation helper

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export function createNodeFromType(
  type: NodeType,
  position: { x: number; y: number }
) {
  const entry = NODE_REGISTRY[type];
  const id = `${type}-${nanoid()}`;
  return {
    id,
    type,
    position,
    data: {
      ...entry.defaultData(),
      name: id,
    },
  };
}

// Re-export NodeCategory and types for convenience
export { NodeCategory };
export type { NodeRegistryEntry };


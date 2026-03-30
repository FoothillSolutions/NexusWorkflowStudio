/**
 * node-registry.ts
 *
 * Thin aggregator that imports all node modules and assembles the
 * canonical NODE_REGISTRY, NODE_TYPE_COMPONENTS map, nodeSchemaMap,
 * and palette helpers used throughout the app.
 */

import type { NodeTypes } from "@xyflow/react";
import type { NodeType } from "@/types/workflow";
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
  start:           startRegistryEntry,
  end:             endRegistryEntry,
  prompt:          promptRegistryEntry,
  script:          scriptRegistryEntry,
  "agent":         subAgentRegistryEntry,
  "parallel-agent": parallelAgentRegistryEntry,
  skill:           skillRegistryEntry,
  document:        documentRegistryEntry,
  "sub-workflow":  subWorkflowRegistryEntry,
  "mcp-tool":      mcpToolRegistryEntry,
  "if-else":       ifElseRegistryEntry,
  switch:          switchRegistryEntry,
  "ask-user":      askUserRegistryEntry,
};

// React Flow node type → component map
export const NODE_TYPE_COMPONENTS: NodeTypes = {
  start:           StartNode,
  end:             EndNode,
  prompt:          PromptNode,
  script:          ScriptNode,
  "agent":         SubAgentNode,
  "parallel-agent": ParallelAgentNode,
  "sub-workflow":  SubWorkflowNode,
  skill:           SkillNode,
  document:        DocumentNode,
  "mcp-tool":      McpToolNode,
  "if-else":       IfElseNode,
  switch:          SwitchNode,
  "ask-user":      AskUserNode,
};

// Schema map
export const nodeSchemaMap = {
  start:           startSchema,
  end:             endSchema,
  prompt:          promptSchema,
  script:          scriptSchema,
  "agent":         subAgentSchema,
  "parallel-agent": parallelAgentSchema,
  "sub-workflow":  subWorkflowSchema,
  skill:           skillSchema,
  document:        documentSchema,
  "mcp-tool":      mcpToolSchema,
  "if-else":       ifElseSchema,
  switch:          switchSchema,
  "ask-user":      askUserSchema,
} as const;

// Palette groupings
const BASIC_NODE_ORDER: NodeType[] = [
  "start",
  "prompt",
  "agent",
  "skill",
  "document",
  "script",
  "sub-workflow",
  "mcp-tool",
];

const CONTROL_FLOW_NODE_ORDER: NodeType[] = [
  "if-else",
  "switch",
  "parallel-agent",
  "ask-user",
  "end",
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


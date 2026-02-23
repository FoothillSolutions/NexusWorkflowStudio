import type { NodeType, WorkflowNodeData } from "@/types/workflow";
import { SubAgentModel, SubAgentMemory } from "@/types/workflow";
import {
  Play,
  MessageSquareText,
  Bot,
  GitBranch,
  Wrench,
  Plug,
  GitFork,
  ArrowRightLeft,
  HelpCircle,
  Square,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

// ── Node category enum ──────────────────────────────────────────────────────
export enum NodeCategory {
  Basic = "basic",
  ControlFlow = "control-flow",
}

// ── Node registry entry ─────────────────────────────────────────────────────
export interface NodeRegistryEntry {
  type: NodeType;
  displayName: string;
  description: string;
  icon: LucideIcon;
  accentColor: string;       // Tailwind color class (e.g. "emerald")
  accentHex: string;         // hex for handles / inline styles
  category: NodeCategory;
  defaultData: () => WorkflowNodeData;
}

// ── Registry ────────────────────────────────────────────────────────────────
export const NODE_REGISTRY: Record<NodeType, NodeRegistryEntry> = {
  start: {
    type: "start",
    displayName: "Start",
    description: "Workflow entry point",
    icon: Play,
    accentColor: "emerald",
    accentHex: "#10b981",
    category: NodeCategory.Basic,
    defaultData: () => ({
      type: "start" as const,
      label: "Start",
      name: "",
    }),
  },
  prompt: {
    type: "prompt",
    displayName: "Prompt",
    description: "LLM prompt template",
    icon: MessageSquareText,
    accentColor: "blue",
    accentHex: "#3b82f6",
    category: NodeCategory.Basic,
    defaultData: () => ({
      type: "prompt" as const,
      label: "Prompt",
      name: "",
      promptText: "Enter your prompt here.\n\nYou can use variables like {{variableName}}.",
      detectedVariables: [],
    }),
  },
  "sub-agent": {
    type: "sub-agent",
    displayName: "Sub-Agent",
    description: "Delegate to an agent",
    icon: Bot,
    accentColor: "violet",
    accentHex: "#8b5cf6",
    category: NodeCategory.Basic,
    defaultData: () => ({
      type: "sub-agent" as const,
      label: "Sub-Agent",
      name: "",
      promptText: "",
      detectedVariables: [] as string[],
      model: SubAgentModel.Inherit,
      memory: SubAgentMemory.Default,
      tools: "",
    }),
  },
  "sub-agent-flow": {
    type: "sub-agent-flow",
    displayName: "Sub-Agent Flow",
    description: "Reference another flow",
    icon: GitBranch,
    accentColor: "purple",
    accentHex: "#a855f7",
    category: NodeCategory.Basic,
    defaultData: () => ({
      type: "sub-agent-flow" as const,
      label: "Sub-Agent Flow",
      name: "",
      flowRef: "",
      nodeCount: 0,
    }),
  },
  skill: {
    type: "skill",
    displayName: "Skill",
    description: "Execute a skill",
    icon: Wrench,
    accentColor: "cyan",
    accentHex: "#06b6d4",
    category: NodeCategory.Basic,
    defaultData: () => ({
      type: "skill" as const,
      label: "Skill",
      name: "",
      skillName: "",
      projectName: "",
    }),
  },
  "mcp-tool": {
    type: "mcp-tool",
    displayName: "MCP Tool",
    description: "Call an MCP tool",
    icon: Plug,
    accentColor: "teal",
    accentHex: "#14b8a6",
    category: NodeCategory.Basic,
    defaultData: () => ({
      type: "mcp-tool" as const,
      label: "MCP Tool",
      name: "",
      toolName: "",
      paramsText: "",
    }),
  },
  "if-else": {
    type: "if-else",
    displayName: "If / Else",
    description: "Conditional branch",
    icon: GitFork,
    accentColor: "amber",
    accentHex: "#f59e0b",
    category: NodeCategory.ControlFlow,
    defaultData: () => ({
      type: "if-else" as const,
      label: "If / Else",
      name: "",
      expression: "",
    }),
  },
  switch: {
    type: "switch",
    displayName: "Switch",
    description: "Multi-way branch",
    icon: ArrowRightLeft,
    accentColor: "orange",
    accentHex: "#f97316",
    category: NodeCategory.ControlFlow,
    defaultData: () => ({
      type: "switch" as const,
      label: "Switch",
      name: "",
      switchExpr: "",
      cases: ["Case 1", "Case 2"],
    }),
  },
  "ask-user": {
    type: "ask-user",
    displayName: "Ask User Question",
    description: "Prompt user for input",
    icon: HelpCircle,
    accentColor: "pink",
    accentHex: "#ec4899",
    category: NodeCategory.ControlFlow,
    defaultData: () => ({
      type: "ask-user" as const,
      label: "Ask User",
      name: "",
      questionText: "",
      options: ["Option 1", "Option 2"],
    }),
  },
  end: {
    type: "end",
    displayName: "END",
    description: "Terminal node",
    icon: Square,
    accentColor: "red",
    accentHex: "#ef4444",
    category: NodeCategory.ControlFlow,
    defaultData: () => ({
      type: "end" as const,
      label: "END",
      name: "",
    }),
  },
};

// ── Helper: create a new node with position ─────────────────────────────────
export function createNodeFromType(
  type: NodeType,
  position: { x: number; y: number }
) {
  const entry = NODE_REGISTRY[type];
  const id = `${type}-${nanoid(8)}`;
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

// ── Palette groupings ───────────────────────────────────────────────────────
export const BASIC_NODES = Object.values(NODE_REGISTRY).filter(
  (n) => n.category === NodeCategory.Basic
);
export const CONTROL_FLOW_NODES = Object.values(NODE_REGISTRY).filter(
  (n) => n.category === NodeCategory.ControlFlow
);

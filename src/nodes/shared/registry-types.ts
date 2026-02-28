import type { LucideIcon } from "lucide-react";
import type { NodeType, WorkflowNodeData } from "@/types/workflow";
import type { NodeSize } from "./base-node";

// ── Node category ───────────────────────────────────────────────────────────
export enum NodeCategory {
  Basic       = "basic",
  ControlFlow = "control-flow",
}

// ── Registry entry shape ────────────────────────────────────────────────────
export interface NodeRegistryEntry {
  type: NodeType;
  displayName: string;
  description: string;
  icon: LucideIcon;
  accentColor: string;   // Tailwind color name (e.g. "emerald")
  accentHex: string;     // hex for handles / inline styles
  category: NodeCategory;
  /** Visual size of the node card. Defaults to Medium when omitted. */
  size?: NodeSize;
  defaultData: () => WorkflowNodeData;
}

// ── Generator contract ──────────────────────────────────────────────────────
/** Each node module exposes an object satisfying this interface. */
export interface NodeGeneratorModule {
  /**
   * Returns the Mermaid node declaration line (shape + label).
   * e.g.  `    nodeId["Prompt: my label"]`
   */
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string;

  /**
   * Returns the Markdown "details" block for this node, or an empty string
   * if the node type has no details to show (e.g. start / end).
   */
  getDetailsSection(nodeId: string, data: WorkflowNodeData): string;

  /**
   * Optionally returns an extra file to generate alongside the workflow file.
   * e.g. `.opencode/agents/<name>.md` for agent nodes.
   */
  getAgentFile?(nodeId: string, data: WorkflowNodeData, connectedSkillNames?: string[]): { path: string; content: string } | null;
}


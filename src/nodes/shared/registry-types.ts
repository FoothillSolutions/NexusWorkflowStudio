import type { LucideIcon } from "lucide-react";
import type { NodeType, WorkflowNodeData } from "@/types/workflow";
import type { GenerationTargetId } from "@/lib/generation-targets";
import type { NodeSize } from "./node-size";

// ── Node category ───────────────────────────────────────────────────────────
export enum NodeCategory {
  Basic       = "basic",
  ControlFlow = "control-flow",
}

// ── AI generation prompt fragment ──────────────────────────────────────────
/** Per-node instructions embedded in each node module's constants and assembled
 *  into the AI workflow-generation system prompt at runtime. */
export interface AiGenerationPrompt {
  /** Short description for the AI about what this node does */
  description: string;
  /** The JSON data template the AI should use when creating this node */
  dataTemplate: string;
  /** Edge handle rules specific to this node type (sourceHandle/targetHandle conventions) */
  edgeRules?: string;
  /** Required fields and their descriptions */
  requiredFields: Array<{ field: string; description: string }>;
  /** Optional fields and their descriptions */
  optionalFields?: Array<{ field: string; description: string; default?: string }>;
  /** Example configuration snippets */
  examples?: string[];
  /** Free-form generation hints (positioning, usage notes, important caveats) */
  generationHints?: string[];
  /** Connection rules: what this node can connect to/from */
  connectionRules?: string;
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
  /** Per-node AI generation prompt fragment. When present, the system prompt
   *  assembler uses this instead of auto-dumping defaultData() fields. */
  aiGenerationPrompt?: AiGenerationPrompt;
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
  getAgentFile?(
    nodeId: string,
    data: WorkflowNodeData,
    connectedSkillNames?: string[],
    connectedDocNames?: string[],
    target?: GenerationTargetId,
  ): { path: string; content: string } | null;

  /**
   * Optionally returns multiple generated agent files for a single node.
   * Useful for fan-out nodes that materialise one subagent per branch.
   */
  getAgentFiles?(
    nodeId: string,
    data: WorkflowNodeData,
    connectedSkillNames?: string[],
    connectedDocNames?: string[],
    target?: GenerationTargetId,
  ): Array<{ path: string; content: string }>;

  /**
   * Optionally returns a document file to generate alongside the workflow file.
   * e.g. `.opencode/docs/<name>.md` for document nodes.
   */
  getDocFile?(
    nodeId: string,
    data: WorkflowNodeData,
    target?: GenerationTargetId,
  ): { path: string; content: string } | null;


  /**
   * Optionally returns a skill file to generate alongside the workflow file.
   * e.g. `.opencode/skills/<name>/SKILL.md` for skill nodes.
   */
  getSkillFile?(
    nodeId: string,
    data: WorkflowNodeData,
    connectedScripts?: Array<{ label: string; fileName: string; variableName: string }>,
    target?: GenerationTargetId,
  ): { path: string; content: string } | null;
}


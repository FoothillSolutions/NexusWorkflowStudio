import type { LibraryCategory } from "@/lib/library";
import type { NodeType } from "@/types/workflow";

// ── Server config ─────────────────────────────────────────────────────────────

export interface MarketplaceSourceConfig {
  /** Unique name used as a key throughout the system */
  name: string;
  /** Remote Git URL (https/ssh) or absolute/relative local path */
  source: string;
  /** Optional Git ref (branch, tag, SHA) to checkout */
  ref?: string;
}

// ── marketplace.json schema ───────────────────────────────────────────────────

export interface MarketplaceJsonOwner {
  name: string;
  email?: string;
}

export interface MarketplaceJsonMetadata {
  pluginRoot?: string;
  description?: string;
  version?: string;
}

export type MarketplaceJsonPluginSource =
  | string
  | { source: string; [key: string]: unknown };

export interface MarketplaceJsonPlugin {
  name: string;
  source: MarketplaceJsonPluginSource;
  description?: string;
  category?: string;
  keywords?: string[];
  version?: string;
}

export interface MarketplaceJson {
  $schema?: string;
  name: string;
  description?: string;
  owner?: MarketplaceJsonOwner;
  metadata?: MarketplaceJsonMetadata;
  plugins: MarketplaceJsonPlugin[];
}

// ── plugin.json schema ────────────────────────────────────────────────────────

export interface PluginJson {
  name?: string;
  description?: string;
  author?: { name: string; email?: string };
  keywords?: string[];
  category?: string;
  version?: string;
}

// ── Node payloads (server-safe, structurally compatible with WorkflowNodeData) ─

export interface AgentNodePayload {
  type: "agent";
  label: string;
  name: string;
  description: string;
  promptText: string;
  detectedVariables: string[];
  model: string;
  memory: string;
  temperature: number;
  color: string;
  disabledTools: string[];
  parameterMappings: string[];
  variableMappings: Record<string, string>;
}

export interface SkillNodePayload {
  type: "skill";
  label: string;
  name: string;
  skillName: string;
  description: string;
  promptText: string;
  detectedVariables: string[];
  variableMappings: Record<string, string>;
  metadata: Array<{ key: string; value: string }>;
}

export interface PromptNodePayload {
  type: "prompt";
  label: string;
  name: string;
  promptText: string;
  detectedVariables: string[];
}

// ── Parsed marketplace library item ───────────────────────────────────────────

export interface MarketplaceLibraryItem {
  /** Stable ID: `mp:<marketplace>:<plugin>:<nodeType>:<name>` */
  id: string;
  name: string;
  category: LibraryCategory;
  nodeType: NodeType;
  savedAt: string;
  updatedAt: string;
  nodeData: AgentNodePayload | SkillNodePayload | PromptNodePayload;
  description?: string;
  /** Marketplace config name this item came from */
  marketplaceName: string;
  /** Plugin name within the marketplace */
  pluginName: string;
  /** Prevents rename/delete in UI */
  readonly: true;
}

// ── Runtime status ────────────────────────────────────────────────────────────

export type MarketplaceStatus = "ok" | "error" | "pending";

export interface MarketplaceState {
  name: string;
  source: string;
  status: MarketplaceStatus;
  itemCount: number;
  lastRefreshed: string | null;
  error: string | null;
}

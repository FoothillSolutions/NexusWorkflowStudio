// ─── Workflow Generation Types ────────────────────────────────────────────────

export type WorkflowGenStatus =
  | "idle"
  | "creating-session"
  | "streaming"
  | "done"
  | "error";

/** Generation mode — either create a new workflow or edit the current one. */
export type WorkflowGenMode = "generate" | "edit";

export interface WorkflowGenState {
  /** Whether the floating panel is visible */
  floating: boolean;
  /** Whether the floating panel body is collapsed */
  collapsed: boolean;
  /** Current generation status */
  status: WorkflowGenStatus;
  /** Current mode — generate from scratch or edit the current workflow */
  mode: WorkflowGenMode;
  /** The user's natural-language prompt */
  prompt: string;
  /** Selected model (providerId/modelId) */
  selectedModel: string | null;
  /** Streamed raw text so far */
  streamedText: string;
  /** Number of nodes parsed so far (for progress display) */
  parsedNodeCount: number;
  /** Number of edges parsed so far */
  parsedEdgeCount: number;
  /** Estimated token count */
  tokenCount: number;
  /** Error message if status is "error" */
  error: string | null;
  /** The active OpenCode session ID */
  sessionId: string | null;
  /** AbortController for the SSE stream */
  _abortController: AbortController | null;
  /** Tracks which node IDs have already been added to the canvas */
  _addedNodeIds: Set<string>;
  /** Tracks which edge IDs have already been added to the canvas */
  _addedEdgeIds: Set<string>;
  /** Edges waiting for their source/target nodes to appear */
  _pendingEdges: Array<Record<string, unknown>>;
  /** Node IDs currently showing the AI rainbow border (reactive — components subscribe to this) */
  _glowingNodeIds: string[];

  // ── Project folder context ──
  /** Whether to include the selected project folder's file tree as context */
  useProjectContext: boolean;
  /** The fetched project folder context string (file tree) */
  projectContext: string | null;
  /** Status of folder context fetching */
  projectContextStatus: "idle" | "loading" | "done" | "error";

  // ── AI-generated examples ──
  /** AI-suggested example prompts (supplement the hardcoded ones) */
  aiExamples: string[];
  /** Status of the AI example generation */
  aiExamplesStatus: "idle" | "loading" | "done" | "error";
  /** Session ID used for generating examples (separate from the main gen session) */
  _examplesSessionId: string | null;
  /** AbortController for the examples request */
  _examplesAbortController: AbortController | null;

  // Actions
  setFloating: (open: boolean) => void;
  toggleCollapsed: () => void;
  close: () => void;
  setPrompt: (prompt: string) => void;
  setSelectedModel: (model: string | null) => void;
  setMode: (mode: WorkflowGenMode) => void;
  setUseProjectContext: (use: boolean) => void;
  /** Fetch the project folder's file tree for context */
  fetchProjectContext: () => Promise<void>;
  generate: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  disposeSession: () => Promise<void>;
  /** Fetch AI-generated example prompts using the connected model.
   *  When `prepend` is true, new examples are added before existing ones
   *  instead of replacing them (keeps the UI populated while loading). */
  fetchAiExamples: (opts?: { prepend?: boolean }) => Promise<void>;
}

/** Result of incrementally extracting workflow data from a partial JSON stream. */
export interface StreamParseResult {
  name?: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}

/** Zustand store accessor types for extracted action functions. */
export type StoreGet = () => WorkflowGenState;
export type StoreSet = {
  (partial: Partial<WorkflowGenState> | ((state: WorkflowGenState) => Partial<WorkflowGenState>)): void;
};

// ── Utilities ────────────────────────────────────────────────────────────────

/** Rough heuristic used to estimate tokens from plain-text character length. */
const APPROXIMATE_CHARS_PER_TOKEN = 4;

/** Estimate token count from text length (rough ~4 chars per token). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / APPROXIMATE_CHARS_PER_TOKEN);
}


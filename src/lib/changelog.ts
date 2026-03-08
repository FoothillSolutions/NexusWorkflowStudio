// ── Changelog ────────────────────────────────────────────────────────────────
// Declare new versions here (newest first). The "What's New" dialog
// automatically shows once per version based on localStorage tracking.

export type ChangeCategory = "New" | "Improved" | "Fixed" | "Removed" | "Breaking";

export interface ChangelogEntry {
  /** Semver version string, e.g. "1.2.0" */
  version: string;
  /** Human-readable date, e.g. "March 4, 2026" */
  date: string;
  /** Grouped changes */
  categories: {
    category: ChangeCategory;
    items: string[];
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Add new entries at the TOP of this array.
// The first entry is always treated as the current version.
// ─────────────────────────────────────────────────────────────────────────────
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.7.0",
    date: "March 5, 2026",
    categories: [
      {
        category: "New",
        items: [
          "AI Workflow Generation",
          "Dynamic example prompts for quick-start AI workflow generation",
          "On-the-fly component rendering — nodes and edges appear live on the canvas as the AI streams the workflow",
        ],
      },
      {
        category: "Improved",
        items: [
          "Improved performance for large workflows with many nodes and edges",
          "Enhanced auto-layout algorithm with better spacing and grouping",
        ],
      },
      {
        category: "Fixed",
        items: [
          "Edge delete icon no longer appears on hover — now only shown when the edge is selected",
        ],
      },
    ],
  },
  {
    version: "1.6.0",
    date: "March 5, 2026",
    categories: [
      {
        category: "New",
        items: [
          "AI Workflow Generation floating panel — undockable, collapsible panel for generating workflows from natural language",
          "Real-time streaming progress — live node/edge count and token count during AI workflow generation",
          "Example prompts — pre-built prompt suggestions for quick-start AI workflow generation",
          "Dynamic tool discovery per model — browse and toggle tools fetched from the OpenCode provider API",
        ],
      },
      {
        category: "Improved",
        items: [
          "Project directory switcher moved into the header for quicker directory changes",
          "Delete confirmation dialog now supports multi-select deletion targets",
        ],
      },
    ],
  },
  {
    version: "1.5.0",
    date: "March 5, 2026",
    categories: [
      {
        category: "New",
        items: [
          "AI Workflow Generation — describe a workflow in natural language and generate it with AI",
          "Streaming generation with real-time progress tracking (node/edge count, token count)",
          "Example prompts for quick-start workflow generation",
          "Keyboard shortcut Ctrl+Alt+A to open AI workflow generation dialog",
        ],
      },
    ],
  },
  {
    version: "1.4.0",
    date: "March 4, 2026",
    categories: [
      {
        category: "New",
        items: [
          "AI-powered prompt generation and editing for agent nodes",
          "Floating undockable prompt generation panel with collapse support",
          "Dynamic tool discovery — browse and toggle tools per model from OpenCode provider API",
          "Dynamic model list fetched live from connected OpenCode server",
        ],
      },
      {
        category: "Improved",
        items: [
          "Agent node properties now display connected skills and documents in a unified list",
          "Prompt generation panel can be docked back into the properties panel or floated freely",
          "Better streaming feedback during AI prompt generation",
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: "March 4, 2026",
    categories: [
      {
        category: "New",
        items: [
          "Project directory switcher — switch between OpenCode project directories without reconnecting",
          "Custom project directory management (add/remove custom paths)",
          "Connect to OpenCode dialog with step-by-step setup instructions",
          "Live connection status indicator in the header",
        ],
      },
      {
        category: "Improved",
        items: [
          "Header actions (Library, Save, Connect, Help) extracted into reusable shared components",
          "Sub-workflow canvas now shares the same header actions as the main canvas",
          "Connection status persists across page reloads",
        ],
      },
      {
        category: "Fixed",
        items: [
          "Fixed edge cases when disconnecting and reconnecting to OpenCode server",
        ],
      },
    ],
  },
  {
    version: "1.2.0",
    date: "March 3, 2026",
    categories: [
      {
        category: "New",
        items: [
          "Sub-workflow canvas — double-click a sub-workflow node to edit its nested graph",
          "Breadcrumb navigation for nested sub-workflow editing with multi-level depth",
          "Ask User node for interactive human-in-the-loop workflows",
          "Fullscreen Markdown editor with split, edit, and preview modes",
          "Workflow code generation — export workflows as downloadable ZIP with generated files",
          "Workflow preview dialog showing generated command Markdown",
        ],
      },
      {
        category: "Improved",
        items: [
          "Auto-layout now uses Dagre with smooth animated transitions",
          "Minimap is suppressed during node drag operations for better performance",
          "Canvas context menu with quick node insertion and edge deletion",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "March 3, 2026",
    categories: [
      {
        category: "New",
        items: [
          "Workflow import from JSON file with Zod validation and error reporting",
          "About dialog with version info, license, and GitHub link",
          "Keyboard shortcuts dialog accessible from Help menu or '?' key",
          "What's New / Patch Notes dialog with per-version auto-popup and full changelog view",
          "Deletable edges with click-to-remove interaction",
        ],
      },
      {
        category: "Improved",
        items: [
          "Node palette now grouped into Basic and Control Flow tabs",
          "Properties panel uses react-hook-form with Zod schema validation",
          "Improved color picker with preset swatches and custom hex input",
          "Static variable mapping for {{var}} references in agent prompts",
          "Parameter mapping with positional $N slot CRUD for agent nodes",
        ],
      },
      {
        category: "Fixed",
        items: [
          "Fixed throttled auto-save occasionally dropping the latest change",
          "Fixed node name collisions when duplicating nodes rapidly",
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "March 2, 2026",
    categories: [
      {
        category: "New",
        items: [
          "Visual workflow editor with drag-and-drop node palette",
          "Sub-agent nodes with skill & document connections",
          "Sub-workflow nodes for nested workflow composition",
          "If/Else and Switch conditional branching nodes",
          "MCP Tool nodes for external tool integration",
          "Prompt & Document nodes with Markdown editing",
          "Workflow library with save, load & export",
          "Keyboard shortcuts for all major actions",
          "Auto-layout for automatic graph arrangement",
          "Dark theme optimised for long editing sessions",
        ],
      },
    ],
  },
];

/** The current app version — derived from the newest changelog entry. */
export const CURRENT_VERSION = CHANGELOG[0].version;


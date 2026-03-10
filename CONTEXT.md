# Nexus Workflow Studio — Project Context

Front-end-only dark-themed drag-and-drop workflow editor built with Next.js. No backend. All persistence is via browser localStorage. Connects to an optional OpenCode server for AI-powered features (prompt generation, workflow generation, dynamic model/tool discovery).

---

## Tech Stack (exact versions)

| Package | Version | Purpose |
|---|---|---|
| next | 16.1.6 | App Router framework (Turbopack dev) |
| react / react-dom | 19.2.3 | UI library |
| typescript | ^5 | Type safety |
| @xyflow/react | ^12.10.1 | Canvas, nodes, edges, minimap, background, controls |
| zustand | ^5.0.11 | Global state management |
| zundo | ^2.3.0 | Undo/redo temporal middleware for Zustand |
| zod | ^4.3.6 | Schema validation (forms + import) |
| react-hook-form | ^7.71.2 | Form state in properties panel |
| @hookform/resolvers | ^5.2.2 | zodResolver bridge |
| @dagrejs/dagre | ^2.0.4 | Directed-graph auto-layout |
| tailwindcss | ^4 | Utility-first CSS (v4 syntax) |
| shadcn/ui (radix-ui) | ^1.4.3 | Prebuilt UI primitives (new-york style) |
| lucide-react | ^0.575.0 | Icons |
| nanoid | ^5.1.6 | Stable node IDs |
| lodash.throttle | ^4.1.1 | Throttled auto-save (2s) |
| react-dropzone | ^15.0.0 | File drag-drop for import |
| next-themes | ^0.4.6 | Dark theme enforcement |
| sonner | ^2.0.7 | Toast notifications |
| @uiw/react-md-editor | ^4.0.11 | Fullscreen Markdown editor |
| jszip | ^3.10.1 | ZIP archive creation for code generation export |
| class-variance-authority | ^0.7.1 | Variant-based component styling |
| clsx + tailwind-merge | latest | `cn()` utility |
| tw-animate-css | ^1.4.0 | Animation CSS for shadcn |

---

## Scripts

```bash
npm run dev      # Start dev server (Turbopack, default port 3000 or next available)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint
npm run typecheck # TypeScript type checking (tsc --noEmit)
```

The dev server typically runs on `http://localhost:3000`. If port 3000 is occupied, Next.js auto-increments.

---

## Directory Structure

```
nexus-workflow-studio/
├── package.json
├── tsconfig.json                    # strict, @/* → ./src/*, bundler moduleResolution
├── next.config.ts                   # Empty (all defaults)
├── components.json                  # shadcn: new-york, neutral, CSS vars, lucide icons
├── postcss.config.mjs
├── eslint.config.mjs
├── docker-compose.yml               # Docker Compose with Bun (default) + Node.js profiles
├── Dockerfile                       # Node.js multi-stage production build
├── Dockerfile.bun                   # Bun multi-stage production build
├── CONTEXT.md                       # This file
├── CONTRIBUTING.md                  # Contribution guide
│
├── src/
│   ├── app/
│   │   ├── globals.css              # Tailwind v4 imports + dark/light CSS vars (oklch)
│   │   ├── layout.tsx               # ThemeProvider, TooltipProvider, Toaster, Geist fonts
│   │   ├── page.tsx                 # Renders <WorkflowEditor />
│   │   └── api/echo/               # API route (echo endpoint)
│   │
│   ├── types/
│   │   └── workflow.ts              # All TS types: discriminated union of 11 node data types,
│   │                                #   WorkflowNode, WorkflowEdge, WorkflowJSON
│   │
│   ├── lib/
│   │   ├── utils.ts                 # cn() helper (clsx + tailwind-merge)
│   │   ├── workflow-schema.ts       # Zod v4 workflowJsonSchema for import/load validation
│   │   ├── node-registry.ts         # NODE_REGISTRY, NODE_TYPE_COMPONENTS, createNodeFromType(), palette groups
│   │   ├── node-colors.ts           # Node accent color definitions
│   │   ├── persistence.ts           # localStorage save/load, JSON export/import, throttledSave
│   │   ├── library.ts              # Library system: save/load workflows & node configs to localStorage
│   │   ├── changelog.ts            # Versioned changelog data (CHANGELOG array, CURRENT_VERSION)
│   │   ├── theme.ts                # Shared theme constants (BG_SURFACE, TEXT_MUTED, etc.)
│   │   ├── platform.ts             # OS-specific keyboard modifier detection (MOD, SHIFT, ALT, etc.)
│   │   ├── workflow-generator.ts   # Workflow code generation (export as .opencode command files)
│   │   └── opencode/               # OpenCode API client library
│   │       ├── index.ts            # Barrel export
│   │       ├── client.ts           # HTTP client for OpenCode server
│   │       ├── errors.ts           # Error types
│   │       ├── types.ts            # API types (Provider, Project, Part, etc.)
│   │       └── services/           # Service modules
│   │
│   ├── hooks/
│   │   ├── index.ts                # Barrel export
│   │   ├── use-auto-layout.ts      # Dagre-based auto-layout with animation (shared by both canvases)
│   │   ├── use-canvas-interactions.ts # Context menu, drag-drop, keyboard shortcuts
│   │   ├── use-drag-tracking.ts    # MiniMap suppression during node drags
│   │   ├── use-models.ts           # Dynamic model list from OpenCode provider API
│   │   ├── use-tools.ts            # Dynamic tool list per model from /experimental/tool API
│   │   └── use-whats-new.ts        # "What's New" dialog open/dismiss with localStorage version tracking
│   │
│   ├── nodes/                       # Node type modules (one folder per type)
│   │   ├── shared/                  # Cross-node shared utilities (form-types, model-select, variable-utils)
│   │   ├── agent/                   # Agent node module
│   │   │   ├── index.ts            # Barrel export
│   │   │   ├── types.ts            # SubAgentNodeData interface
│   │   │   ├── enums.ts            # SubAgentModel, SubAgentMemory enums
│   │   │   ├── constants.ts        # Registry entry, Zod schema, AGENT_TOOLS, PRESET_COLORS
│   │   │   ├── node.tsx            # React Flow node component
│   │   │   ├── fields.tsx          # Properties panel orchestrator
│   │   │   ├── generator.ts        # Code generation logic
│   │   │   ├── ai-prompt-generator.tsx  # AI prompt generation dialog
│   │   │   ├── prompt-gen-body.tsx  # Prompt generation form body (freeform + structured modes)
│   │   │   ├── parse-agent-file.ts # .md agent file parser
│   │   │   └── properties/         # Extracted property panel sub-components
│   │   │       ├── upload-agent-button.tsx      # File upload + agent parsing
│   │   │       ├── static-variable-mapping.tsx  # {{var}} → resource dropdown mapping
│   │   │       ├── parameter-mapping.tsx        # $N positional slot CRUD
│   │   │       ├── connected-nodes-list.tsx     # Unified skills/docs connected list
│   │   │       ├── tools-grid.tsx               # Dynamic tools enable/disable grid
│   │   │       ├── color-picker.tsx             # Preset swatches + custom hex picker
│   │   │       └── use-connected-resources.ts   # Hook: derives connected skills/docs from store
│   │   ├── sub-workflow/            # Sub-workflow node module (same-context + agent modes)
│   │   ├── prompt/                  # Prompt node module
│   │   ├── skill/                   # Skill node module
│   │   ├── mcp-tool/                # MCP Tool node module
│   │   ├── start/                   # Start node module
│   │   ├── end/                     # End node module
│   │   ├── if-else/                 # If-Else node module (multi-branch)
│   │   ├── switch/                  # Switch node module (multi-branch)
│   │   ├── ask-user/                # Ask User node module (human-in-the-loop)
│   │   └── document/                # Document node module (inline + linked content)
│   │
│   ├── store/
│   │   ├── workflow-store.ts        # Zustand store with zundo temporal middleware (undo/redo)
│   │   ├── library-store.ts         # Library/saved workflows store
│   │   ├── opencode-store.ts        # OpenCode connection, providers, models, projects
│   │   ├── prompt-gen-store.ts      # AI prompt generation session store
│   │   ├── workflow-gen-store.ts    # Re-export shim for workflow generation store
│   │   └── workflow-gen/            # Modular workflow generation store
│   │       ├── index.ts            # Barrel export
│   │       ├── types.ts            # WorkflowGenStatus, WorkflowGenState
│   │       ├── system-prompt.ts    # System prompt for AI workflow generation
│   │       ├── workflow-generator.ts # Streaming workflow generation logic
│   │       ├── streaming-parser.ts  # Real-time JSON stream parser
│   │       ├── edge-fixer.ts       # Post-generation edge validation/fixing
│   │       ├── examples-generator.ts # Example workflow prompts
│   │       └── project-context.ts  # Project context injection
│   │
│   └── components/
│       ├── ui/                      # shadcn components (DO NOT hand-edit)
│       │   ├── alert-dialog.tsx
│       │   ├── badge.tsx
│       │   ├── button.tsx
│       │   ├── dialog.tsx
│       │   ├── dropdown-menu.tsx
│       │   ├── fullscreen-markdown-editor.tsx
│       │   ├── input.tsx
│       │   ├── label.tsx
│       │   ├── markdown-editor.tsx
│       │   ├── scroll-area.tsx
│       │   ├── separator.tsx
│       │   ├── sheet.tsx
│       │   ├── sonner.tsx
│       │   ├── tabs.tsx
│       │   ├── textarea.tsx
│       │   └── tooltip.tsx
│       │
│       ├── edges/
│       │   └── deletable-edge.tsx   # Custom edge with delete-on-select interaction
│       │
│       ├── nodes/                   # 12 files: base wrapper + 11 node type components
│       │   ├── base-node.tsx        # Shared visual wrapper (accent bar, icon, label, handles)
│       │   ├── start-node.tsx
│       │   ├── prompt-node.tsx
│       │   ├── sub-agent-node.tsx
│       │   ├── sub-workflow-node.tsx
│       │   ├── skill-node.tsx
│       │   ├── mcp-tool-node.tsx
│       │   ├── document-node.tsx
│       │   ├── if-else-node.tsx
│       │   ├── switch-node.tsx
│       │   ├── ask-user-node.tsx
│       │   └── end-node.tsx
│       │
│       └── workflow/                # Layout & feature components
│           ├── workflow-editor.tsx   # Root: ReactFlowProvider, keyboard shortcuts, auto-save
│           ├── header.tsx           # Top bar: brand, editable name, File/Library/Help, Generate
│           ├── shared-header-actions.tsx # Shared header actions (Library, Save, Connect, Help)
│           ├── node-palette.tsx     # Left sidebar: collapsible, tabbed (Basic/Control), draggable
│           ├── canvas.tsx           # ReactFlow instance: drag-drop, background, controls, minimap
│           ├── canvas-shell.tsx     # Canvas wrapper with toolbar integration
│           ├── canvas-toolbar.tsx   # Canvas toolbar: hand/selection mode, edge style, auto-layout
│           ├── sub-workflow-canvas.tsx # Nested sub-workflow editing canvas with breadcrumbs
│           ├── properties-panel.tsx # Right Sheet: react-hook-form + zodResolver, type fields
│           ├── properties/          # Extracted per-type property field components
│           │   ├── type-specific-fields.tsx  # Switch dispatcher for node-type-specific fields
│           │   ├── prompt-fields.tsx
│           │   ├── sub-agent-fields.tsx
│           │   ├── sub-workflow-fields.tsx
│           │   ├── skill-fields.tsx
│           │   ├── document-fields.tsx
│           │   ├── mcp-tool-fields.tsx
│           │   ├── if-else-fields.tsx
│           │   ├── switch-fields.tsx
│           │   ├── ask-user-fields.tsx
│           │   ├── variable-utils.tsx
│           │   ├── types.ts
│           │   └── index.ts
│           ├── context-menu.tsx     # Right-click context menu (duplicate, delete, save to library, group)
│           ├── delete-dialog.tsx    # AlertDialog for delete confirmation (single + multi-select)
│           ├── load-dialog.tsx      # Dialog with "Load Last Saved" option
│           ├── import-dialog.tsx    # Dialog with react-dropzone for JSON file import
│           ├── connect-dialog.tsx   # OpenCode connection dialog with setup instructions
│           ├── library-panel.tsx    # Library sidebar: saved workflows + reusable node configs
│           ├── project-switcher.tsx # OpenCode project directory switcher
│           ├── floating-prompt-gen.tsx   # Floating AI prompt generation panel
│           ├── floating-workflow-gen.tsx # Floating AI workflow generation panel
│           ├── workflow-preview-dialog.tsx # Generated workflow Markdown preview
│           ├── about-dialog.tsx     # About dialog with version, license, GitHub link
│           ├── shortcuts-dialog.tsx # Keyboard shortcuts reference dialog
│           └── whats-new-dialog.tsx # "What's New" / Patch Notes dialog (auto-popup + full changelog)
```

---

## Data Model

### Node Types (11 total)

All node data types extend `BaseNodeData { type: NodeType; label: string; name: string }` via `Record<string, unknown>`.
The discriminated union key is the `type` field.

| Type | Extra Fields | Icon | Category | Module |
|---|---|---|---|---|
| `start` | (none) | Play | basic | `nodes/start/` |
| `prompt` | `promptText`, `detectedVariables` | MessageSquareText | basic | `nodes/prompt/` |
| `agent` | `description`, `promptText`, `model`, `memory`, `temperature`, `color`, `disabledTools`, `parameterMappings`, `variableMappings` | Bot | basic | `nodes/agent/` |
| `sub-workflow` | `mode` (same-context/agent), `subNodes`, `subEdges`, `nodeCount`, + agent-mode fields | GitBranch | basic | `nodes/sub-workflow/` |
| `skill` | `skillName`, `projectName`, `description`, `promptText`, `detectedVariables`, `metadata` | Wrench | basic | `nodes/skill/` |
| `document` | `docName`, `contentMode` (inline/linked), `fileExtension`, `contentText`, `linkedFileName`, `linkedFileContent`, `description` | FileText | basic | `nodes/document/` |
| `mcp-tool` | `toolName`, `paramsText` | Plug | basic | `nodes/mcp-tool/` |
| `if-else` | `evaluationTarget`, `branches[]` (label+condition) | GitFork | control-flow | `nodes/if-else/` |
| `switch` | `evaluationTarget`, `branches[]` (label+condition) | ArrowRightLeft | control-flow | `nodes/switch/` |
| `ask-user` | `questionText`, `multipleSelection`, `aiSuggestOptions`, `options[]` (label+description) | HelpCircle | control-flow | `nodes/ask-user/` |
| `end` | (none) | Square | control-flow | `nodes/end/` |

### React Flow Type Aliases

```typescript
type WorkflowNode = Node<WorkflowNodeData, string>;  // @xyflow/react Node generic
type WorkflowEdge = Edge;                             // Unparameterized
```

### Persisted JSON Shape (`WorkflowJSON`)

```typescript
interface WorkflowJSON {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  ui: {
    sidebarOpen: boolean;
    minimapVisible: boolean;
    viewport: { x: number; y: number; zoom: number };
    canvasMode?: string;
    edgeStyle?: string;
  };
}
```

---

## Zustand Stores

### Main Workflow Store (`useWorkflowStore`)

Created with `create<WorkflowState>()` wrapped in `temporal()` middleware from zundo for undo/redo support.

#### State Shape

```typescript
interface WorkflowState {
  // Data
  name: string;                    // Default: "Untitled Workflow"
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  // UI
  sidebarOpen: boolean;            // Default: true
  minimapVisible: boolean;         // Default: true
  selectedNodeId: string | null;
  propertiesPanelOpen: boolean;    // Default: false
  viewport: Viewport;             // Default: { x: 0, y: 0, zoom: 1 }
  canvasMode: CanvasMode;         // "hand" | "selection"
  edgeStyle: EdgeStyle;           // "bezier" | "smoothstep"

  // Delete confirmation
  deleteTarget: { type: "node" | "edge" | "selection"; id: string } | null;

  // Sub-workflow editing
  activeSubWorkflowNodeId: string | null;

  // React Flow callbacks (bound to store)
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions (see below)
}
```

#### Actions

| Action | Signature | Description |
|---|---|---|
| `setName` | `(name: string) => void` | Update workflow name |
| `addNode` | `(type: NodeType, position: {x,y}) => void` | Creates node via `createNodeFromType()` |
| `updateNodeData` | `(nodeId: string, data: Partial<WorkflowNodeData>) => void` | Merges partial data into node |
| `deleteNode` | `(nodeId: string) => void` | Removes node + connected edges, clears selection |
| `deleteEdge` | `(edgeId: string) => void` | Removes edge |
| `selectNode` | `(nodeId: string \| null) => void` | Sets selectedNodeId |
| `openPropertiesPanel` | `(nodeId: string) => void` | Sets selectedNodeId + opens panel |
| `closePropertiesPanel` | `() => void` | Closes panel (keeps selection) |
| `toggleSidebar` | `() => void` | Toggles left palette |
| `toggleMinimap` | `() => void` | Toggles minimap visibility |
| `setCanvasMode` | `(mode: CanvasMode) => void` | Switch between hand/selection tool |
| `toggleEdgeStyle` | `() => void` | Toggle between bezier/smoothstep edges |
| `setViewport` | `(viewport: Viewport) => void` | Stores current viewport |
| `setDeleteTarget` | `(target \| null) => void` | Opens/closes delete confirmation |
| `confirmDelete` | `() => void` | Executes pending delete, clears target |
| `duplicateNode` | `(nodeId: string) => void` | Duplicates a single node |
| `duplicateSelectedNodes` | `() => void` | Duplicates all selected nodes |
| `deleteSelectedNodes` | `() => void` | Deletes all selected nodes |
| `selectAll` | `() => void` | Selects all nodes |
| `loadWorkflow` | `(json: WorkflowJSON) => void` | Replaces entire state from JSON |
| `getWorkflowJSON` | `() => WorkflowJSON` | Serializes current state |
| `reset` | `() => void` | Resets to initial state |

### Additional Stores

| Store | File | Purpose |
|---|---|---|
| `useSavedWorkflowsStore` | `library-store.ts` | Library system: saved workflows, reusable node configs, CRUD operations |
| `useOpenCodeStore` | `opencode-store.ts` | OpenCode connection state, provider/model discovery, project switching |
| `usePromptGenStore` | `prompt-gen-store.ts` | AI prompt generation sessions, streaming state, freeform/structured modes |
| `useWorkflowGenStore` | `workflow-gen/` | AI workflow generation: streaming parser, real-time node streaming |

---

## Persistence Layer

**File**: `src/lib/persistence.ts`

| Function | Description |
|---|---|
| `saveToLocalStorage(data)` | `localStorage.setItem(STORAGE_KEY, JSON.stringify(data))` |
| `loadFromLocalStorage()` | Parses + validates with `workflowJsonSchema.safeParse()`, returns null on failure |
| `hasSavedWorkflow()` | Boolean check for key existence |
| `exportWorkflow(data)` | Creates Blob → download link → triggers download as `{name}.json` |
| `importWorkflow(file)` | `file.text()` → JSON.parse → zod validation → returns `WorkflowJSON` or throws |
| `throttledSave` | `lodash.throttle(saveToLocalStorage, 2000, { leading: false, trailing: true })` |

**localStorage key**: `"nexus-workflow-studio:last"`

**What's New version key**: `"nexus-workflow-studio:last-seen-version"` — stores the last changelog version the user dismissed. Compared against `CURRENT_VERSION` on load.

**Auto-save mechanism**: `workflow-editor.tsx` subscribes to the entire Zustand store via `useWorkflowStore.subscribe()` and calls `throttledSave()` on every state change.

---

## OpenCode Integration

**Directory**: `src/lib/opencode/`

Nexus optionally connects to an [OpenCode](https://github.com/nichochar/opencode) server for AI features:

- **AI Prompt Generation** — generate or edit agent/skill/prompt text via streaming LLM calls
- **AI Workflow Generation** — describe a workflow in natural language and have it generated in real-time on the canvas
- **Dynamic Model Discovery** — fetch available models from connected providers (GitHub Copilot, Anthropic, OpenAI, Google, etc.)
- **Dynamic Tool Discovery** — browse and toggle tools available per model
- **Project Directory Switching** — switch OpenCode project context without reconnecting

Connection is managed via `useOpenCodeStore`. The Connect dialog (`connect-dialog.tsx`) provides step-by-step setup instructions. Connection status is shown in the header.

---

## UI Architecture

### Layout (top to bottom)

```
┌──────────────────────────────────────────────────────────────────┐
│ Header (h-12, bg-zinc-900)                                      │
│  "Nexus Workflow Studio"  │  [editable name]  │ File Library     │
│  │ Project Switcher │ Connect │ Generate │ Help                  │
├────────────┬─────────────────────────────────────────────────────┤
│ NodePalette│ Canvas (ReactFlow)                     Properties  │
│ (w-280px   │  bg: #181818                           Panel       │
│  or w-12   │  dotted grid: #333, gap 20, size 1     (Sheet,     │
│  collapsed)│  Canvas Toolbar (top-left)               w-380px,  │
│ Tabs:      │  Controls (bottom-left)                 right side)│
│  Basic     │  Minimap (toggleable, bottom-right)                │
│  Control   │  Context Menu (right-click)                        │
├────────────┴─────────────────────────────────────────────────────┤
│ Floating Panels (undockable, draggable):                         │
│   FloatingPromptGen — AI prompt generation                       │
│   FloatingWorkflowGen — AI workflow generation                   │
│                                                                  │
│ Modal Dialogs:                                                   │
│   DeleteDialog, LoadDialog, ImportDialog, ConnectDialog,         │
│   AboutDialog, ShortcutsDialog, WhatsNewDialog,                  │
│   WorkflowPreviewDialog, LibraryPanel                            │
└──────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
RootLayout (layout.tsx)
  └─ ThemeProvider (defaultTheme="dark")
     └─ TooltipProvider
        └─ Home (page.tsx)
           └─ WorkflowEditor (workflow-editor.tsx)  ← "use client"
              └─ ReactFlowProvider
                 ├─ Header
                 │   ├─ ProjectSwitcher
                 │   ├─ SharedHeaderActions (Library, Save, Connect, Help)
                 │   └─ LoadDialog / ImportDialog
                 ├─ NodePalette
                 ├─ CanvasShell
                 │   ├─ Canvas / SubWorkflowCanvas
                 │   │   ├─ ReactFlow (with nodeTypes map)
                 │   │   │   ├─ Background (dots)
                 │   │   │   ├─ Controls
                 │   │   │   └─ MiniMap (conditional)
                 │   │   └─ ContextMenu
                 │   └─ CanvasToolbar
                 ├─ PropertiesPanel (Sheet)
                 ├─ FloatingPromptGen
                 ├─ FloatingWorkflowGen
                 ├─ LibraryPanel
                 ├─ DeleteDialog (AlertDialog)
                 ├─ ConnectDialog
                 ├─ AboutDialog
                 ├─ ShortcutsDialog
                 ├─ WorkflowPreviewDialog
                 └─ WhatsNewDialog
```

### ReactFlow Configuration

```typescript
// canvas.tsx
<ReactFlow
  deleteKeyCode={null}          // We handle delete ourselves (confirmation dialog)
  fitView
  defaultEdgeOptions={{
    type: "smoothstep",         // Toggleable via CanvasToolbar (smoothstep / bezier)
    style: { stroke: "#555", strokeWidth: 2 },
  }}
  proOptions={{ hideAttribution: true }}
/>
```

### Properties Panel

- Opens on node **double-click** (`onNodeDoubleClick`)
- Uses `react-hook-form` with `zodResolver` for per-type validation
- `useWatch()` syncs form values → store in real-time (no submit button)
- Form `reset()` is called when `selectedNodeId` changes
- Type-specific field components dispatched via `TypeSpecificFields`
- Agent nodes include AI prompt generation (dockable/floating)
- Delete button at bottom triggers `setDeleteTarget()`

---

## Component Architecture

### Base Node Pattern

All 11 node components follow this structure:

```typescript
// Named export (NOT default)
export function StartNode({ data, selected }: NodeProps<Node<StartNodeData>>) {
  const entry = NODE_REGISTRY["start"];
  return (
    <BaseNode
      accentHex={entry.accentHex}
      selected={selected}
      label={data.label}
      type={entry.displayName}
      icon={entry.icon}
    >
      {/* Optional body content */}
      <Handle type="source" position={Position.Bottom} ... />
    </BaseNode>
  );
}
```

**Key conventions:**
- All node components use **named exports** (`export function XNode`), not default exports
- Node type in `NodeProps` must be `NodeProps<Node<TData>>`, NOT `NodeProps<TData>` (v12 API)
- Each node looks up its registry entry from `NODE_REGISTRY` for icon/color
- `BaseNode` renders: accent bar (3px top), icon + label header, type badge, children body
- Handles use `style={{ background: entry.accentHex }}` for accent-colored connection points
- Start nodes: source handle only (Bottom)
- End nodes: target handle only (Top)
- If-Else: target (Top) + dynamic source handles from `data.branches`
- Switch: target (Top) + dynamic source handles from `data.branches` + default handle

### Node Registration

Nodes must be registered in multiple places:
1. `src/types/workflow.ts` — Add data interface + union member
2. `src/nodes/<type>/constants.ts` — Add Zod schema + registry entry
3. `src/lib/node-registry.ts` — Import and add entry to `NODE_REGISTRY`, `NODE_TYPE_COMPONENTS`, `nodeSchemaMap`
4. `src/nodes/<type>/node.tsx` — Create node component
5. `src/nodes/<type>/fields.tsx` — Create properties panel fields
6. `src/components/workflow/properties/type-specific-fields.tsx` — Add case in `TypeSpecificFields`

---

## Keyboard Shortcuts

Handled in `workflow-editor.tsx` via `window.addEventListener("keydown", ...)`:

| Shortcut | Action | Guard |
|---|---|---|
| `Ctrl+S` / `Cmd+S` | Save to localStorage + toast | `e.preventDefault()` |
| `Ctrl+Z` / `Cmd+Z` | Undo | — |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo | — |
| `Ctrl+A` / `Cmd+A` | Select all nodes | — |
| `Ctrl+D` / `Cmd+D` | Duplicate selected node(s) | — |
| `Ctrl+Alt+A` | Open AI workflow generation | — |
| `H` | Hand tool | — |
| `V` | Selection tool | — |
| `?` | Open shortcuts dialog | — |
| `Escape` | Close properties panel | — |
| `Delete` / `Backspace` | Open delete confirmation for selected node(s) | Skipped if focus is in input/textarea/contentEditable |

---

## Changelog / What's New System

**File**: `src/lib/changelog.ts`

Declares a `CHANGELOG` array of `ChangelogEntry` objects (newest first). Each entry has:
- `version` — semver string (e.g. `"1.7.0"`)
- `date` — human-readable date string
- `categories` — array of `{ category: ChangeCategory; items: string[] }`

`ChangeCategory` is a union: `"New" | "Improved" | "Fixed" | "Removed" | "Breaking"`.

`CURRENT_VERSION` is derived from `CHANGELOG[0].version`.

### Adding a New Version

Add a new entry at the **top** of the `CHANGELOG` array in `src/lib/changelog.ts`. The dialog will automatically show once for every user who hasn't seen that version yet.

### Hook: `useWhatsNew`

**File**: `src/hooks/use-whats-new.ts`

Returns `{ open, dismiss }`. Uses a `useState` lazy initializer that reads `localStorage("nexus-workflow-studio:last-seen-version")` and compares to `CURRENT_VERSION`. Also listens for the `nexus:open-patch-notes` custom event to allow manual opening from the header Help menu.

### Dialog: `WhatsNewDialog`

**File**: `src/components/workflow/whats-new-dialog.tsx`

Supports two modes:
- **"latest"** — Auto-popup showing only the newest changelog entry. Footer includes a "View all patch notes" button.
- **"full"** — Shows all changelog versions with separators and a "Latest" badge on the newest. Opened via `nexus:open-patch-notes` event from Help → Patch Notes.

### Custom Events

| Event | Dispatched By | Handled By |
|---|---|---|
| `nexus:open-patch-notes` | `HelpMenu` (Patch Notes menu item) | `useWhatsNew` hook + `WhatsNewDialog` (switches to "full" mode) |
| `nexus:fit-view` | Various (import, load, generate) | Canvas (calls `fitView()`) |
| `nexus:auto-layout` | CanvasToolbar | Canvas (triggers Dagre auto-layout) |

---

## Drag-and-Drop Flow

1. `NodePalette` sets `event.dataTransfer.setData("application/reactflow", nodeType)`
2. `Canvas.onDragOver` calls `e.preventDefault()` + `dropEffect = "move"`
3. `Canvas.onDrop` reads dataTransfer, converts screen position via `screenToFlowPosition()`, calls `addNode(type, position)`
4. `addNode` in store calls `createNodeFromType(type, position)` which generates a node with `id: "{type}-{nanoid(8)}"`

---

## Coding Conventions

### General
- All components that use hooks or browser APIs are marked `"use client"`
- Path alias: `@/*` → `./src/*`
- Default exports for layout/page/workflow components, named exports for node components
- TypeScript strict mode enabled
- ESLint with `eslint-config-next`

### Styling
- Dark theme: `bg-zinc-950` (app bg), `bg-zinc-900` (cards/panels), `bg-zinc-800` (hover/active)
- Borders: `border-zinc-800`, `border-zinc-700`
- Text: `text-zinc-100` (primary), `text-zinc-400` (secondary), `text-zinc-500` (muted)
- Canvas: `bg-[#181818]` with `#333` dotted grid
- All CSS variables use oklch color space
- Theme constants centralized in `src/lib/theme.ts` (BG_SURFACE, TEXT_MUTED, etc.)

### shadcn/ui Configuration

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

To add a new shadcn component:
```bash
npx shadcn@latest add <component-name>
```

**Do NOT hand-edit files in `src/components/ui/`.** They are generated by shadcn CLI.

---

## Known Pitfalls & Discoveries

### Zod v4 Import Path
```typescript
// CORRECT
import { z } from "zod/v4";

// WRONG — will fail at runtime
import { z } from "zod";
```

### @xyflow/react v12 NodeProps Typing
```typescript
// CORRECT — T must extend Node
NodeProps<Node<MyNodeData>>

// WRONG — raw data type does not satisfy Node constraint
NodeProps<MyNodeData>
```

### Tailwind CSS v4 Syntax
```css
/* CORRECT — v4 uses @import */
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

/* WRONG — v3 directives do not work in v4 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### zodResolver Type Mismatch
When `useForm` infers types from `defaultValues: Record<string, unknown>`, the resolver typed for a specific zod schema causes a TS error. The intentional fix is:
```typescript
resolver: schema ? (zodResolver(schema) as any) : undefined,
```
This is the ONE acceptable `as any` in the codebase.

### useFieldArray with String Arrays
`react-hook-form`'s `useFieldArray` expects object arrays, but our `branches` and `options` fields are object arrays with `label`+`condition`/`description` pairs. Earlier versions used `string[]` with a `name: "cases" as never` workaround.

### Node Component Exports
All node components use **named exports**. If you use default exports, the import in `canvas.tsx` will break:
```typescript
import { StartNode } from "@/components/nodes/start-node";
```

### Edge Deletion
React Flow's built-in `deleteKeyCode` is set to `null`. All deletion goes through our confirmation dialog (`DeleteDialog`). Custom `DeletableEdge` component shows a delete icon when the edge is selected.

### Auto-Save Breadth
The Zustand subscription in `workflow-editor.tsx` fires on EVERY state change (including viewport drags). `throttledSave` (2s, trailing) prevents excessive writes, but be aware that viewport-only changes do get persisted.

---

## Adding a New Node Type (Step-by-Step)

1. **Types** — `src/types/workflow.ts`:
   - Add a new interface extending `BaseNodeData` with `type: "my-type"` literal
   - Add it to the `WorkflowNodeData` union
   - Add `"my-type"` to the `NODE_TYPES` const array

2. **Node Module** — Create `src/nodes/my-type/` with:
   - `types.ts` — TypeScript interface for node data
   - `constants.ts` — Zod schema + registry entry
   - `node.tsx` — React Flow node component (named export)
   - `fields.tsx` — Properties panel form fields (orchestrator)
   - `generator.ts` — Code generation logic
   - `index.ts` — Barrel export
   - `properties/` — (optional) Extracted sub-components for complex property panels

3. **Registry** — `src/lib/node-registry.ts`:
   - Import node module and add to `NODE_REGISTRY`, `NODE_TYPE_COMPONENTS`, `nodeSchemaMap`

4. **Properties** — `src/components/workflow/properties/type-specific-fields.tsx`:
   - Add case for `"my-type"` in `TypeSpecificFields` switch

5. **Verify**: `npm run build` must pass with zero errors.

---

## Verification Steps

```bash
# Build check (must exit 0 with no errors)
npm run build

# Dev server
npm run dev
# Then open http://localhost:3000 and verify:
#   - Header renders with "Nexus Workflow Studio" and editable name
#   - Left sidebar shows 11 node types across Basic/Control tabs
#   - Dragging a node from palette to canvas creates it
#   - Double-clicking a node opens the properties panel
#   - Editing properties updates the node in real-time
#   - Ctrl+S saves, toast appears
#   - Ctrl+Z / Ctrl+Shift+Z undo/redo works
#   - Export downloads a .json file
#   - Import dialog accepts .json file with Zod validation
#   - Load dialog supports "Load Last Saved"
#   - Delete/Backspace on selected node shows confirmation dialog
#   - Multi-select with Shift+click or selection tool, bulk delete/duplicate
#   - Escape closes properties panel
#   - Minimap toggles via bottom-right button
#   - Sidebar collapses/expands via chevron button
#   - Canvas toolbar: hand/selection mode, edge style toggle, auto-layout
#   - Right-click context menu: duplicate, delete, save to library, group into sub-workflow
#   - Sub-workflow: double-click opens nested canvas with breadcrumbs
#   - "What's New" dialog shows on first visit (or after version bump)
#   - Help → Patch Notes opens full changelog with all versions
#   - Connect to OpenCode: models load, AI generation works
#   - AI prompt generation: freeform + structured modes, streaming
#   - AI workflow generation: floating panel, real-time node streaming
#   - Library panel: save/load workflows, save/load node configs
#   - Code generation: export as .opencode command files (ZIP download)
```

---

## Fonts

- **Sans**: Geist (`--font-geist-sans`)
- **Mono**: Geist Mono (`--font-geist-mono`)
- Loaded via `next/font/google` in `layout.tsx`

---

## Deployment

Vercel-ready. No environment variables needed. No backend required (OpenCode connection is optional for AI features). Just:
```bash
npm run build && npm run start
```

Or connect the repo to Vercel for automatic deployments.

Docker support available via `docker-compose.yml` with Bun (default) and Node.js runtime profiles.

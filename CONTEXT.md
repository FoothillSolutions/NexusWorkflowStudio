# Nexus Workflow Studio — Project Context

Front-end-only dark-themed drag-and-drop workflow editor built with Next.js. No backend. All persistence is via browser localStorage.

---

## Tech Stack (exact versions)

| Package | Version | Purpose |
|---|---|---|
| next | 16.1.6 | App Router framework (Turbopack dev) |
| react / react-dom | 19.2.3 | UI library |
| typescript | ^5 | Type safety |
| @xyflow/react | ^12.10.1 | Canvas, nodes, edges, minimap, background, controls |
| zustand | ^5.0.11 | Global state management |
| zod | ^4.3.6 | Schema validation (forms + import) |
| react-hook-form | ^7.71.2 | Form state in properties panel |
| @hookform/resolvers | ^5.2.2 | zodResolver bridge |
| tailwindcss | ^4 | Utility-first CSS (v4 syntax) |
| shadcn/ui (radix-ui) | ^1.4.3 | Prebuilt UI primitives (new-york style) |
| lucide-react | ^0.575.0 | Icons |
| nanoid | ^5.1.6 | Stable node IDs |
| lodash.throttle | ^4.1.1 | Throttled auto-save (2s) |
| react-dropzone | ^15.0.0 | File drag-drop for import |
| next-themes | ^0.4.6 | Dark theme enforcement |
| sonner | ^2.0.7 | Toast notifications |
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
├── CONTEXT.md                       # This file
│
├── src/
│   ├── app/
│   │   ├── globals.css              # Tailwind v4 imports + dark/light CSS vars (oklch)
│   │   ├── layout.tsx               # ThemeProvider, TooltipProvider, Toaster, Geist fonts
│   │   └── page.tsx                 # Renders <WorkflowEditor />
│   │
│   ├── types/
│   │   └── workflow.ts              # All TS types: discriminated union of 10 node data types,
│   │                                #   WorkflowNode, WorkflowEdge, WorkflowJSON
│   │
│   ├── lib/
│   │   ├── utils.ts                 # cn() helper (clsx + tailwind-merge)
│   │   ├── workflow-schema.ts       # Zod v4 workflowJsonSchema for import/load validation
│   │   ├── node-registry.ts         # NODE_REGISTRY, NODE_TYPE_COMPONENTS, createNodeFromType(), palette groups
│   │   ├── persistence.ts           # localStorage save/load, JSON export/import, throttledSave
│   │   └── changelog.ts             # Versioned changelog data (CHANGELOG array, CURRENT_VERSION)
│   │
│   ├── hooks/
│   │   ├── use-auto-layout.ts       # Dagre-based auto-layout with animation (shared by both canvases)
│   │   ├── use-canvas-interactions.ts # Context menu, drag-drop, keyboard shortcuts
│   │   ├── use-drag-tracking.ts     # MiniMap suppression during node drags
│   │   ├── use-models.ts            # Dynamic model list from OpenCode provider API
│   │   ├── use-tools.ts             # Dynamic tool list per model from /experimental/tool API
│   │   └── use-whats-new.ts         # "What's New" dialog open/dismiss with localStorage version tracking
│   │
│   ├── nodes/                       # Node type modules (one folder per type)
│   │   ├── shared/                  # Cross-node shared utilities (form-types, variable-utils, etc.)
│   │   ├── agent/                   # Agent node module (formerly sub-agent)
│   │   │   ├── index.ts             # Barrel export
│   │   │   ├── types.ts             # SubAgentNodeData interface
│   │   │   ├── enums.ts             # SubAgentModel, SubAgentMemory enums
│   │   │   ├── constants.ts         # Registry entry, Zod schema, AGENT_TOOLS, PRESET_COLORS
│   │   │   ├── node.tsx             # React Flow node component
│   │   │   ├── fields.tsx           # Properties panel orchestrator (~200 lines)
│   │   │   ├── generator.ts         # Code generation logic
│   │   │   ├── ai-prompt-generator.tsx  # AI prompt generation dialog
│   │   │   ├── prompt-gen-body.tsx   # Prompt generation form body
│   │   │   ├── parse-agent-file.ts  # .md agent file parser
│   │   │   └── properties/          # Extracted property panel sub-components
│   │   │       ├── upload-agent-button.tsx      # File upload + agent parsing
│   │   │       ├── static-variable-mapping.tsx  # {{var}} → resource dropdown mapping
│   │   │       ├── parameter-mapping.tsx        # $N positional slot CRUD
│   │   │       ├── connected-nodes-list.tsx     # Unified skills/docs connected list
│   │   │       ├── tools-grid.tsx               # Dynamic tools enable/disable grid
│   │   │       ├── color-picker.tsx             # Preset swatches + custom hex picker
│   │   │       └── use-connected-resources.ts   # Hook: derives connected skills/docs from store
│   │   ├── sub-workflow/            # Sub-workflow node module
│   │   ├── prompt/                  # Prompt node module
│   │   ├── skill/                   # Skill node module
│   │   ├── mcp-tool/                # MCP Tool node module
│   │   ├── start/                   # Start node module
│   │   ├── end/                     # End node module
│   │   ├── if-else/                 # If-Else node module
│   │   ├── switch/                  # Switch node module
│   │   ├── ask-user/                # Ask User node module
│   │   └── document/                # Document node module
│   │
│   ├── store/
│   │   └── workflow-store.ts         # Zustand store (single flat store, all state + actions)
│   │
│   └── components/
│       ├── ui/                      # 13 shadcn components (DO NOT hand-edit)
│       │   ├── alert-dialog.tsx
│       │   ├── badge.tsx
│       │   ├── button.tsx
│       │   ├── dialog.tsx
│       │   ├── input.tsx
│       │   ├── label.tsx
│       │   ├── scroll-area.tsx
│       │   ├── separator.tsx
│       │   ├── sheet.tsx
│       │   ├── sonner.tsx
│       │   ├── tabs.tsx
│       │   ├── textarea.tsx
│       │   └── tooltip.tsx
│       │
│       ├── nodes/                   # 11 files: base wrapper + 10 node type components
│       │   ├── base-node.tsx         # Shared visual wrapper (accent bar, icon, label, handles)
│       │   ├── start-node.tsx
│       │   ├── prompt-node.tsx
│       │   ├── sub-agent-node.tsx    # Re-exports from src/nodes/agent/
│       │   ├── sub-workflow-node.tsx
│       │   ├── skill-node.tsx
│       │   ├── mcp-tool-node.tsx
│       │   ├── if-else-node.tsx
│       │   ├── switch-node.tsx
│       │   ├── ask-user-node.tsx
│       │   └── end-node.tsx
│       │
│       └── workflow/                # 7 layout/feature components
│           ├── workflow-editor.tsx   # Root: ReactFlowProvider, keyboard shortcuts, auto-save
│           ├── header.tsx            # Top bar: brand, editable name, File/Library/Help, Preview (dev), Generate
│           ├── node-palette.tsx      # Left sidebar: collapsible, tabbed (Basic/Control), draggable
│           ├── canvas.tsx            # ReactFlow instance: drag-drop, background, controls, minimap
│           ├── properties-panel.tsx  # Right Sheet: react-hook-form + zodResolver, type fields
│           ├── delete-dialog.tsx     # AlertDialog for delete confirmation
│           ├── load-dialog.tsx       # Dialog with react-dropzone + "Load Last Saved"
│           └── whats-new-dialog.tsx  # "What's New" / Patch Notes dialog (latest + full changelog)
```

---

## Data Model

### Node Types (10 total)

All node data types extend `BaseNodeData { type: NodeType; label: string }` via `Record<string, unknown>`.
The discriminated union key is the `type` field.

| Type | Extra Fields | Icon | Accent Hex | Category | Module |
|---|---|---|---|---|---|
| `start` | (none) | Play | `#10b981` (emerald) | basic | `nodes/start/` |
| `prompt` | `promptText: string`, `detectedVariables: string[]` | MessageSquareText | `#3b82f6` (blue) | basic | `nodes/prompt/` |
| `sub-agent` | `agentName: string`, `taskText: string` | Bot | `#8b5cf6` (violet) | basic | `nodes/agent/` |
| `sub-workflow` | `flowRef: string`, `nodeCount: number` | GitBranch | `#a855f7` (purple) | basic | `nodes/sub-workflow/` |
| `skill` | `skillName: string`, `projectName: string` | Wrench | `#06b6d4` (cyan) | basic | `nodes/skill/` |
| `mcp-tool` | `toolName: string`, `paramsText: string` | Plug | `#14b8a6` (teal) | basic | `nodes/mcp-tool/` |
| `if-else` | `expression: string` | GitFork | `#f59e0b` (amber) | control-flow | `nodes/if-else/` |
| `switch` | `switchExpr: string`, `cases: string[]` | ArrowRightLeft | `#f97316` (orange) | control-flow | `nodes/switch/` |
| `ask-user` | `questionText: string`, `options: string[]` | HelpCircle | `#ec4899` (pink) | control-flow | `nodes/ask-user/` |
| `end` | (none) | Square | `#ef4444` (red) | control-flow | `nodes/end/` |

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
  };
}
```

---

## Zustand Store (`useWorkflowStore`)

Single flat store created with `create<WorkflowState>()`. No middleware, no persistence middleware — persistence is handled manually via subscription.

### State Shape

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

  // Delete confirmation
  deleteTarget: { type: "node" | "edge"; id: string } | null;

  // React Flow callbacks (bound to store)
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions (see below)
}
```

### Actions

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
| `setViewport` | `(viewport: Viewport) => void` | Stores current viewport |
| `setDeleteTarget` | `(target \| null) => void` | Opens/closes delete confirmation |
| `confirmDelete` | `() => void` | Executes pending delete, clears target |
| `loadWorkflow` | `(json: WorkflowJSON) => void` | Replaces entire state from JSON |
| `getWorkflowJSON` | `() => WorkflowJSON` | Serializes current state |
| `reset` | `() => void` | Resets to initial state |

### onConnect Behavior

New edges are created with `type: "smoothstep"` via `addEdge({ ...connection, type: "smoothstep" }, edges)`.

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

**What's New version key**: `"nexus-workflow-studio:last-seen-version"` — stores the last changelog version the user dismissed. Compared against `CURRENT_VERSION` (derived from `CHANGELOG[0].version` in `src/lib/changelog.ts`) on load. If they differ, the "What's New" dialog auto-shows.

**Auto-save mechanism**: `workflow-editor.tsx` subscribes to the entire Zustand store via `useWorkflowStore.subscribe()` and calls `throttledSave()` on every state change.

---

## UI Architecture

### Layout (top to bottom)

```
┌──────────────────────────────────────────────────────────────────┐
│ Header (h-12, bg-zinc-900)                                      │
│  "Nexus Workflow Studio"  │  [editable name]  │ File Library     │
│  │ Preview (dev only) Generate │ Help                            │
├────────────┬─────────────────────────────────────────────────────┤
│ NodePalette│ Canvas (ReactFlow)                     Properties  │
│ (w-280px   │  bg: #181818                           Panel       │
│  or w-12   │  dotted grid: #333, gap 20, size 1     (Sheet,     │
│  collapsed)│  Controls (bottom-left)                 w-380px,   │
│ Tabs:      │  Minimap (toggleable, bottom-right)     right side)│
│  Basic     │  Minimap toggle button                             │
│  Control   │                                                    │
├────────────┴─────────────────────────────────────────────────────┤
│ DeleteDialog (AlertDialog, modal, centered)                      │
│ WhatsNewDialog (Dialog, modal — auto-shows on version update,    │
│   also openable from Help → Patch Notes for full changelog)      │
│ LoadDialog (Dialog, modal, centered)                             │
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
                 │   └─ LoadDialog
                 ├─ NodePalette
                 ├─ Canvas
                 │   ├─ ReactFlow (with nodeTypes map)
                 │   │   ├─ Background (dots)
                 │   │   ├─ Controls
                 │   │   └─ MiniMap (conditional)
                 │   └─ Minimap toggle Button
                 ├─ PropertiesPanel (Sheet)
                 ├─ DeleteDialog (AlertDialog)
                 └─ WhatsNewDialog (Dialog — auto-popup + Help → Patch Notes)
```

### ReactFlow Configuration

```typescript
// canvas.tsx
<ReactFlow
  deleteKeyCode={null}          // We handle delete ourselves (confirmation dialog)
  fitView
  defaultEdgeOptions={{
    type: "smoothstep",
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
- Type-specific field components: `PromptFields`, `SubAgentFields`, etc.
- `SwitchFields` and `AskUserFields` use `useFieldArray` for dynamic string arrays (with `name: "cases" as never` workaround)
- Delete button at bottom triggers `setDeleteTarget()`
- `zodResolver(schema) as any` cast is intentional — resolves type mismatch between `useForm` defaultValues inference and schema type

---

## Component Architecture

### Base Node Pattern

All 10 node components follow this structure:

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
- If-Else: target (Top) + two source handles (Bottom-left "True", Bottom-right "False")
- Switch: target (Top) + dynamic source handles from `data.cases` + default handle

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
| `Escape` | Close properties panel | — |
| `Delete` / `Backspace` | Open delete confirmation for selected node | Skipped if focus is in input/textarea/contentEditable |

---

## Changelog / What's New System

**File**: `src/lib/changelog.ts`

Declares a `CHANGELOG` array of `ChangelogEntry` objects (newest first). Each entry has:
- `version` — semver string (e.g. `"1.2.0"`)
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

Mode resets to "latest" when the dialog closes.

### Custom Events

| Event | Dispatched By | Handled By |
|---|---|---|
| `nexus:open-patch-notes` | `HelpMenu` (Patch Notes menu item) | `useWhatsNew` hook + `WhatsNewDialog` (switches to "full" mode) |

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

### Header Button Order (left → right)

`Brand` | `Editable Name` | **File** | **Library** | divider | **Preview** *(dev only)* | **Generate** | divider | **Help**

- **Preview** button is conditionally rendered via `process.env.NODE_ENV === "development"`. It is tree-shaken out of production builds.
- **Generate** is the primary action button (green accent).

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
This is the ONE acceptable `as any` in the codebase — it exists because `useForm`'s generic inference conflicts with the dynamic schema selection pattern.

### useFieldArray with String Arrays
`react-hook-form`'s `useFieldArray` expects object arrays, but our `cases` and `options` fields are `string[]`. Workaround:
```typescript
const { fields, append, remove } = useFieldArray({
  control,
  name: "cases" as never,  // Bypass type constraint
});
```

### Node Component Exports
All node components use **named exports**. If you use default exports, the import in `canvas.tsx` will break:
```typescript
// In canvas.tsx — expects named imports
import { StartNode } from "@/components/nodes/start-node";
```

### Edge Deletion
React Flow's built-in `deleteKeyCode` is set to `null`. All deletion goes through our confirmation dialog (`DeleteDialog`). The keyboard handler in `workflow-editor.tsx` only triggers deletion for nodes (via `selectedNodeId`). Edge deletion confirmation can be triggered programmatically via `setDeleteTarget({ type: "edge", id })` but no UI currently wires this.

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
     (see `src/nodes/agent/properties/` for the canonical example: tools-grid, color-picker, etc.
      These are reusable — sub-workflow imports ToolsGrid and ColorPicker from agent/properties/)

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
#   - Left sidebar shows 10 node types across Basic/Control tabs
#   - Dragging a node from palette to canvas creates it
#   - Double-clicking a node opens the properties panel
#   - Editing properties updates the node in real-time
#   - Ctrl+S saves, toast appears
#   - Export downloads a .json file
#   - Load dialog accepts .json file import and "Load Last Saved"
#   - Delete/Backspace on selected node shows confirmation dialog
#   - Escape closes properties panel
#   - Minimap toggles via bottom-right button
#   - Sidebar collapses/expands via chevron button
#   - "What's New" dialog shows on first visit (or after version bump)
#   - Help → Patch Notes opens full changelog with all versions
#   - Dismissing "What's New" prevents re-show until next version
```

---

## Fonts

- **Sans**: Geist (`--font-geist-sans`)
- **Mono**: Geist Mono (`--font-geist-mono`)
- Loaded via `next/font/google` in `layout.tsx`

---

## Deployment

Vercel-ready. No environment variables needed. No backend. Just:
```bash
npm run build && npm run start
```

Or connect the repo to Vercel for automatic deployments.
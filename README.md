# Nexus Workflow Studio

A visual workflow editor for designing, composing, and exporting AI agent workflows. Build complex multi-agent systems with a drag-and-drop interface — no code required.

## Features

### 🎨 Visual Workflow Canvas
- **Drag-and-Drop Editor** — design workflows by dragging nodes from the palette onto an infinite canvas
- **Hand & Selection Tools** — switch between panning and multi-select modes
- **Edge Styles** — toggle between bezier and smoothstep connection lines
- **Auto-Layout** — one-click automatic graph arrangement with smooth animation
- **Minimap** — toggleable bird's-eye view for navigating large workflows
- **Right-Click Context Menu** — quick access to duplicate, delete, save to library, and group actions

### 🧩 11 Node Types
| Category | Nodes | Description |
|---|---|---|
| **Basic** | Start, End | Define workflow entry and exit points |
| **AI** | Agent, Prompt, Skill | Configure AI agents with models, memory, tools, and detailed prompts |
| **Resources** | Document, MCP Tool | Attach documents (inline or linked) and external tool integrations |
| **Control Flow** | If-Else, Switch, Ask User | Conditional branching, multi-path routing, and human-in-the-loop interactions |
| **Composition** | Sub-Workflow | Nest workflows inside workflows with full breadcrumb navigation |

### 🤖 AI-Powered Generation
- **AI Workflow Generation** — describe a workflow in natural language and watch it build itself in real-time on the canvas
- **AI Prompt Generation** — generate or refine agent prompts with freeform or structured template modes
- **AI Prompt Editing** — send your existing prompt with an edit instruction to iteratively improve it
- **Streaming Responses** — live token-by-token generation with progress tracking
- **Dynamic Model Selection** — choose from all available models across connected providers (GitHub Copilot, Anthropic, OpenAI, Google, and more)

### 📚 Library System
- **Save & Load Workflows** — persist workflows to your browser's local storage
- **Reusable Node Configs** — save individual node configurations to the library for reuse across workflows
- **Import & Export** — import/export workflows as JSON files for sharing and backup
- **Code Generation** — export workflows as `.opencode` command files in a downloadable ZIP

### 🔧 Agent Configuration
- **Model Selection** — pick from dynamically discovered models across all connected providers
- **Memory Modes** — configure agent memory strategies (full, summary, last-n, none)
- **Temperature Control** — fine-tune response creativity per agent
- **Tool Management** — browse and toggle available tools per model with a visual grid
- **Parameter Mapping** — define positional `$N` parameters passed to delegated agents
- **Variable Mapping** — map `{{variables}}` in prompts to connected skills and documents
- **Color Coding** — assign custom colors to agents for visual organization
- **Agent File Upload** — import `.md` agent definition files directly

### 📝 Rich Content Editing
- **Markdown Editor** — fullscreen split/edit/preview modes for prompt and document content
- **Document Nodes** — inline content or linked file references with support for `.md`, `.txt`, `.json`, `.yaml`
- **Variable Detection** — automatic detection and highlighting of `{{variables}}` and `$N` parameters in prompts

### 🔄 Sub-Workflows
- **Nested Composition** — embed workflows inside sub-workflow nodes for modular design
- **Breadcrumb Navigation** — drill into nested sub-workflows with a clear navigation trail
- **Two Modes** — run sub-workflows in same-context mode or as an independent agent

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + S` | Save workflow |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + A` | Select all |
| `Ctrl/Cmd + D` | Duplicate |
| `Ctrl/Cmd + Alt + A` | AI Generate Workflow |
| `H` / `V` | Hand tool / Selection tool |
| `?` | View all shortcuts |
| `Delete` / `Backspace` | Delete selected |
| `Escape` | Close panel |

### 🌙 Dark Theme
Purpose-built dark UI optimized for extended use, with a carefully tuned color palette across all components.

## Connecting to OpenCode

AI features (prompt generation, workflow generation, model/tool discovery) require a running [OpenCode](https://github.com/nichochar/opencode) server:

1. **Install opencode**: `npm i -g opencode-ai`
2. **Start the server** from your project directory: `opencode serve --cors http://localhost:3000`
3. **Connect** via the Connect button in the header

Once connected, Nexus automatically discovers available models and tools from your configured providers.

> **Note:** The editor works fully offline for designing and exporting workflows. OpenCode is only needed for AI-powered generation features.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

## License

[MIT](LICENSE) © Nexus Workflow Studio Contributors

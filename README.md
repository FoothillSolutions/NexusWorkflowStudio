# Nexus Workflow Studio

Nexus is a visual workflow editor for designing, composing, and exporting AI workflows. You build workflows on a drag-and-drop canvas, connect agents and control-flow nodes, then generate runnable command files for tools such as OpenCode, PI, and Claude Code.

## Features

### 🎨 Visual Workflow Canvas

- Drag-and-drop workflow editing on an infinite canvas
- Auto-layout for quick graph cleanup
- Multi-select, copy/paste, and keyboard shortcuts
- Nested sub-workflows with breadcrumb navigation

### 🤖 AI-Powered Generation

- AI workflow generation from natural-language descriptions
- AI prompt generation and prompt editing for agent nodes
- Dynamic model discovery from connected providers
- Dynamic tool discovery from the connected OpenCode server

### 📚 Library, Import, and Export

- Save workflows locally and reload them later
- Save reusable node configurations to the library
- Browse and import pre-built agents, skills, and prompts from remote marketplace library repositories
- Import and export workflow JSON files
- Generate runnable workflow artifacts for `OpenCode`, `PI`, and `Claude Code`
- Export generated files as a ZIP or write them directly into a target folder
- Include generated `run-<workflow>.sh` and `run-<workflow>.bat` helper scripts with exported workflow artifacts

### 📝 Content and Agent Authoring

- Fullscreen editing for prompts and documents
- Synced scrolling between editor and viewer in fullscreen prompt split view
- Skill, document, and script attachments for richer agent behavior
- Variable mapping and positional parameter mapping for generated workflows
- Agent configuration for model, memory, tools, and temperature

## Available nodes

Nexus currently supports **13 workflow node types**.

### Basic nodes

| Node | Purpose |
|---|---|
| `Start` | Entry point of the workflow |
| `Prompt` | Plain natural-language instruction block used in generated workflow output |
| `Script` | Attaches custom script content for skill execution |
| `Agent` | Delegates work to an AI agent with model, memory, tools, variables, and parameter mappings |
| `Parallel Agent` | Fans work out across multiple downstream agent branches in parallel |
| `Skill` | Reusable skill definition that can be attached to agents |
| `Document` | Attaches inline or linked documents to agents |
| `Sub Workflow` | Embeds a nested workflow, either in same-context mode or agent mode |
| `MCP Tool` | Represents an MCP tool call in the workflow |
| `End` | Terminal node of the workflow |

### Control flow nodes

| Node | Purpose |
|---|---|
| `If / Else` | Conditional branching |
| `Switch` | Multi-way branching |
| `Ask User Question` | Human-in-the-loop branch selection |

## Getting started

### Requirements

- Bun `>= 1.3.10`

### Install and run

```bash
bun install
bun run dev
```

Open the app in your browser at the local Next.js URL shown in the terminal, usually:

```text
http://localhost:3000
```

### Other useful commands

```bash
bun run build
bun run start
bun run lint
bun run typecheck
```

### Docker

The default container setup now uses Bun as well:

```bash
bun run docker:up
bun run docker:down
```

## Usage

### 1. Build a workflow

1. Create or rename your workflow in the header.
2. Drag nodes from the palette onto the canvas.
3. Connect the nodes to define execution flow.
4. Select a node to edit its properties in the properties panel.
5. Use auto-layout to organize larger graphs.

### 2. Add agent resources

- Attach `Skill` nodes to agents for reusable capabilities.
- Attach `Document` nodes to agents for reference material.
- Attach `Script` nodes to skills when the generated skill should include runnable script files.
- Use parameter mappings when an agent should receive positional arguments such as `$1`, `$2`, and `$3`.

### 3. Use AI features (optional)

AI features require a running [OpenCode](https://github.com/nichochar/opencode) server **or** a compatible bridge endpoint such as the bundled ACP bridge.

```bash
bun add -g opencode-ai
opencode serve --cors http://localhost:3000
```

Then connect from the Nexus header.

### Optional: run the bundled ACP bridge

The repository also includes a minimal ACP bridge under `packages/nexus-acp-bridge/`. It exposes the subset of the OpenCode-style HTTP/SSE API that Nexus currently uses, so you can point Nexus at the bridge URL instead of a direct OpenCode server.

```bash
bun run bridge:acp
```

By default the bridge listens on:

```text
http://127.0.0.1:4080
```

You can configure it with the environment variables documented in `packages/nexus-acp-bridge/README.md` and the example file at `packages/nexus-acp-bridge/examples/.env.claude.example`.

An OpenCode server or compatible bridge is only required for AI-powered features such as:

- AI workflow generation
- AI prompt generation and editing
- Dynamic model discovery
- Dynamic tool discovery

The editor itself still works offline for workflow design and export.

## Generate workflow files

When your canvas is ready, open the generate/export flow from the app and choose a target:

- `OpenCode`
- `PI`
- `Claude Code`

Nexus generates files based on your workflow name and node connections.

### Generated output structure

Depending on the selected target, Nexus writes files under one of these root folders:

- `.opencode`
- `.pi`
- `.claude`

Typical generated files include:

- `commands/<workflow-name>.md`
- `agents/<agent-name>.md`
- `skills/<skill-name>/SKILL.md`
- `skills/<skill-name>/scripts/<script-file>`
- `docs/<document-file>`
- `run-<workflow-name>.sh`
- `run-<workflow-name>.bat`

You can also:

- import workflow JSON back into Nexus for editing
- save workflow layouts and reusable nodes into the library
- preview generated output before exporting

The workflow command name is generated from the workflow title by:

- converting it to lowercase
- replacing spaces with `-`
- removing unsupported characters

So a workflow named:

```text
My Workflow
```

becomes:

```text
my-workflow
```

## Run a generated workflow

After exporting the generated files into the target tool's command directory, run the workflow by its generated command name:

```text
/my-workflow [params]
```

Examples:

```text
/my-workflow
/my-workflow customer-123
/my-workflow customer-123, high-priority, en
```

Workflow parameters are **comma-separated and trimmed**.

For example:

```text
/my-workflow 2, 5, 10
```

maps to:

- `$1 = 2`
- `$2 = 5`
- `$3 = 10`

These positional values can then be passed through agent parameter mappings inside the workflow.

### Optional generated runner scripts

Nexus also exports helper launchers next to the generated workflow artifacts:

- `run-<workflow-name>.sh` for Bash-compatible shells
- `run-<workflow-name>.bat` for Windows Command Prompt

Run them from your repository root so the selected target CLI can receive the current project directory automatically.

Examples:

```bash
bash run-my-workflow.sh
bash run-my-workflow.sh customer-123
```

```bat
run-my-workflow.bat
run-my-workflow.bat customer-123
```

## Marketplace

Nexus can pull reusable agents, skills, and prompts from Git-hosted marketplace repositories. Marketplace items appear as read-only entries in the library panel.

### Quick setup

Set the `NEXUS_MARKETPLACES` environment variable to a comma-separated list of Git URLs or local paths:

```bash
NEXUS_MARKETPLACES=https://github.com/org/marketplace-repo,/path/to/local/marketplace
```

To pin a specific branch or tag, append `#ref`:

```bash
NEXUS_MARKETPLACES=https://github.com/org/marketplace-repo#v2.0
```

### Alternative: JSON config file

For advanced configuration (explicit names, multiple refs), create a `nexus-marketplaces.json` file in the project root or point to one via `NEXUS_MARKETPLACES_FILE`:

```json
[
  { "name": "my-marketplace", "source": "https://github.com/org/repo", "ref": "main" }
]
```

### Marketplace repository structure

Each marketplace repo must contain a `.claude-plugin/marketplace.json` manifest:

```json
{
  "name": "My Marketplace",
  "plugins": [
    { "name": "my-plugin", "source": "./plugins/my-plugin" }
  ]
}
```

Each plugin directory can contain:

- `agents/*.md` — Agent definitions with YAML frontmatter
- `skills/*/SKILL.md` — Skill definitions
- `commands/*.md` — Prompt templates

### Refreshing

Click the refresh button in the library panel header to pull the latest from all configured marketplaces.

#### Auto-refresh

Nexus refreshes marketplace data automatically on a server-side timer. The default interval is **1 hour**. Configure via `NEXUS_MARKETPLACE_REFRESH_INTERVAL`:

```bash
# Every 30 minutes
NEXUS_MARKETPLACE_REFRESH_INTERVAL=30m

# Every 90 seconds
NEXUS_MARKETPLACE_REFRESH_INTERVAL=90s

# Raw milliseconds also work
NEXUS_MARKETPLACE_REFRESH_INTERVAL=600000

# Disable auto-refresh entirely
NEXUS_MARKETPLACE_REFRESH_INTERVAL=0
```

The timer starts after the initial refresh on server startup completes. Manual refreshes (via the UI button or `POST /api/marketplaces`) reset the countdown, so a refresh never fires redundantly right after a manual one.

## Recommended workflow authoring flow

1. Create the main execution path from `Start` to `End`
2. Add `Agent`, `Prompt`, and control-flow nodes
3. Attach `Skill`, `Document`, and `Script` nodes where needed
4. Save reusable pieces to the library when they can be reused
5. Generate files for your target environment
6. Run the generated command using `/<workflow-name> [params]`

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + S` | Save workflow |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + A` | Select all |
| `Ctrl/Cmd + D` | Duplicate |
| `Ctrl/Cmd + Alt + E` | Export workflow JSON |
| `Ctrl/Cmd + Alt + G` | Open generate/export dialog |
| `Ctrl/Cmd + Alt + A` | AI generate workflow |
| `Ctrl/Cmd + Alt + P` | Preview generated output |
| `H` / `V` | Hand tool / Selection tool |
| `?` | View all shortcuts |
| `Delete` / `Backspace` | Delete selected |
| `Escape` | Close panel |

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE) © Nexus Workflow Studio Contributors

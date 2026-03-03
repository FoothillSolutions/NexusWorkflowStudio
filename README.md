# Nexus Workflow Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React Flow](https://img.shields.io/badge/React%20Flow-12-ff0072)](https://reactflow.dev)

A visual workflow editor for designing, composing, and exporting AI agent workflows. Built with **Next.js**, **React Flow**, **Zustand**, and **Zod**.

## Features

- **Visual Drag-and-Drop Canvas** — design workflows by dragging nodes from the palette onto an infinite canvas
- **11 Node Types** — Start, End, Prompt, Agent, Skill, Document, MCP Tool, If-Else, Switch, Ask User, Sub-Workflow
- **Sub-Workflows** — nest workflows inside sub-workflow nodes with full breadcrumb navigation
- **Properties Panel** — configure every node via a type-safe form with Zod validation
- **Library System** — save/load workflows and reusable node configurations to localStorage
- **Code Generation** — export workflows as `.opencode` command files with a single click
- **Mermaid Preview** — visualize workflow structure as a Mermaid diagram
- **Auto-Layout** — automatic Dagre-based graph layout with smooth animation
- **Undo/Redo** — full history support via Zundo
- **Keyboard Shortcuts** — comprehensive shortcut set (`?` to view all)
- **Dark Theme** — purpose-built dark UI optimized for extended use

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.18
- **npm** ≥ 9

### Installation

```bash
git clone https://github.com/anthropics/nexus-workflow-studio.git
cd nexus-workflow-studio
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Canvas | [React Flow 12](https://reactflow.dev) |
| State | [Zustand 5](https://zustand.docs.pmnd.rs) + [Zundo](https://github.com/charkour/zundo) |
| Validation | [Zod 4](https://zod.dev) |
| Forms | [React Hook Form 7](https://react-hook-form.com) |
| UI | [Radix UI](https://www.radix-ui.com) + [Tailwind CSS 4](https://tailwindcss.com) |
| Layout | [Dagre](https://github.com/dagrejs/dagre) |
| Icons | [Lucide React](https://lucide.dev) |

## Project Structure

```
src/
├── app/              # Next.js App Router pages & layout
├── components/
│   ├── edges/        # Custom React Flow edge components
│   ├── nodes/        # React Flow node components
│   ├── ui/           # Shared UI primitives (shadcn/ui)
│   └── workflow/     # Workflow editor components (canvas, panels, dialogs)
├── hooks/            # Shared React hooks (canvas interactions, layout, etc.)
├── lib/              # Core utilities (registry, persistence, theme, codegen)
├── nodes/            # Node module definitions (schema, fields, generator, types)
│   ├── shared/       # Shared node utilities (base node, form types, etc.)
│   ├── start/
│   ├── end/
│   ├── prompt/
│   ├── sub-agent/
│   ├── sub-workflow/
│   ├── skill/
│   ├── document/
│   ├── mcp-tool/
│   ├── if-else/
│   ├── switch/
│   └── ask-user/
├── store/            # Zustand stores (workflow state, library state)
└── types/            # TypeScript type definitions
```

## Adding a New Node Type

See [CONTRIBUTING.md](CONTRIBUTING.md) for the step-by-step guide.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

## License

[MIT](LICENSE) © Nexus Workflow Studio Contributors

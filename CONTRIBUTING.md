# Contributing to Nexus Workflow Studio

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- **Bun** ≥ 1.3.10

### Getting Started

```bash
git clone https://github.com/anthropics/nexus-workflow-studio.git
cd nexus-workflow-studio
bun install
bun run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start the development server |
| `bun run build` | Build for production |
| `bun run start` | Start the production server |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | Run TypeScript type checking |

## Architecture Overview

The project uses a **modular node architecture** — each node type is a self-contained module under `src/nodes/` that exports its schema, component, fields, generator, and registry entry.

### Key Directories

- **`src/store/`** — Zustand stores for workflow state and library state
- **`src/lib/`** — Core utilities (node registry, persistence, code generation, theme)
- **`src/hooks/`** — Shared React hooks (canvas interactions, auto-layout, etc.)
- **`src/nodes/`** — Node type modules (each with constants, fields, generator, types)
- **`src/components/workflow/`** — Workflow editor UI components

## Adding a New Node Type

Each node type is a module under `src/nodes/<node-type>/` with these files:

### 1. `types.ts` — TypeScript interface

```ts
import type { BaseNodeData } from "@/types/workflow";

export interface MyNodeData extends BaseNodeData {
  type: "my-node";
  myField: string;
}
```

### 2. `constants.ts` — Zod schema + registry entry

```ts
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/base-node";
import { MyIcon } from "lucide-react";

export const myNodeSchema = z.object({
  type: z.literal("my-node"),
  label: z.string().min(1),
  name: z.string(),
  myField: z.string(),
});

export const myNodeRegistryEntry: NodeRegistryEntry = {
  type: "my-node",
  displayName: "My Node",
  description: "Description here",
  icon: MyIcon,
  accentHex: "#ffffff",
  size: NodeSize.Medium,
  category: NodeCategory.Basic,
  defaultData: () => ({
    type: "my-node" as const,
    label: "My Node",
    myField: "",
  }),
};
```

### 3. `node.tsx` — React Flow node component

### 4. `fields.tsx` — Properties panel form fields

### 5. `generator.ts` — Code generation logic

### 6. `index.ts` — Public barrel export

After creating the module, register it in:
- `src/lib/node-registry.ts`
- `src/types/workflow.ts` (add to `NodeType` union)
- `src/components/workflow/properties/type-specific-fields.tsx`

## Pull Request Process

1. Fork the repository and create a feature branch from `main`
2. Make your changes with clear, descriptive commits
3. Ensure `bun run lint` and `bun run typecheck` pass
4. Ensure `bun run build` succeeds
5. Update documentation if you've changed public APIs
6. Submit a PR with a clear description of the change

## Code Style

- TypeScript strict mode
- Functional React components with hooks
- Zustand for state management (individual selectors preferred over object destructuring)
- Zod v4 for schema validation (import from `"zod/v4"`)
- Tailwind CSS for styling (dark theme)
- Lucide React for icons

## Reporting Issues

Use GitHub Issues for bug reports and feature requests. Please include:
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Browser and OS information
- Screenshots if applicable

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.


---
name: nexus-node-guide
description: "Complete guide for adding or modifying node types in Nexus Workflow Studio. Covers the full touchpoint chain: type definitions, registry, node module (constants/types/fields/generator/component), React Flow renderer, properties panel wiring, generators for all export targets, and tests. Use when adding a new node, modifying an existing node, changing node behavior, or updating node generation output. Also triggers on: node type, workflow node, add node, new node, modify node, node properties, node generator, node fields."
---

# Nexus Node Development Guide

Adding or modifying a node type in Nexus is the most multi-file operation in the codebase. This guide ensures every touchpoint is covered.

## Node Architecture Overview

Each node type is a self-contained module under `src/nodes/<type>/` that exports its schema, component, fields, generator, and registry entry. The node system connects to the rest of the app through several integration points.

## Complete Touchpoint Chain

When adding a **new** node type, create/modify all of these. When **modifying** an existing node, check each one for relevance.

### 1. Type Definition — `src/types/workflow.ts`

Add the data interface extending `BaseNodeData`:

```typescript
export interface MyNodeData extends BaseNodeData {
  type: WorkflowNodeType.MyNode;
  // node-specific fields
}
```

Add it to the `WorkflowNodeData` union type.

### 2. Node Type Enum — `src/types/node-types.ts`

Add the type to `WorkflowNodeType` enum and to the relevant category sets (`NODE_TYPES`, and optionally `AGENT_LIKE_NODE_TYPES`, `ATTACHMENT_NODE_TYPES`, `BRANCHING_NODE_TYPES`, `LIBRARY_SAVEABLE_NODE_TYPES`, `NON_DELETABLE_NODE_TYPES`).

### 3. Node Module — `src/nodes/<type>/`

Create the module directory with these files:

| File | Purpose |
|------|---------|
| `constants.ts` | Default node color, default data factory |
| `types.ts` | Re-export or local type definition |
| `fields.tsx` | Form fields component for the properties panel |
| `generator.ts` | Artifact generation logic for all export targets |
| `node.tsx` | React Flow node renderer component |
| `index.ts` | Barrel export + `nodeRegistryEntry` object |

**`index.ts` registry entry pattern:**
```typescript
import type { NodeRegistryEntry } from "@/lib/node-registry";

export const myNodeEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.MyNode,
  label: "My Node",
  category: "basic", // or "control-flow"
  component: MyNodeComponent,
  fields: MyNodeFields,
  defaultData: createDefaultMyNodeData,
  color: MY_NODE_COLOR,
};
```

### 4. Registry — `src/lib/node-registry.ts`

Import and register the entry from the node module's `index.ts`. This wires the node into the palette and the canvas.

### 5. React Flow Renderer — `src/components/nodes/<type>-node.tsx`

Create the visual node component. Use the `NodeProps<Node<MyNodeData>>` pattern:

```typescript
import type { Node, NodeProps } from "@xyflow/react";

export function MyNode({ data, selected }: NodeProps<Node<MyNodeData>>) {
  // render
}
```

Study existing node renderers (e.g., `prompt-node.tsx`, `skill-node.tsx`) for the established visual patterns, handle positions, and styling conventions.

### 6. Properties Panel — `src/components/workflow/properties/type-specific-fields.tsx`

Add a case for the new node type so the properties panel renders the correct fields when the node is selected.

### 7. Generator / Export

Update `src/nodes/<type>/generator.ts` to produce correct output for all three export targets:
- **OpenCode** (`.opencode/`)
- **PI** (`.pi/`)
- **Claude Code** (`.claude/`)

Check `src/lib/workflow-generation/` and `src/lib/workflow-generator.ts` if the node affects the overall generation pipeline.

### 8. Tests

Add tests at `src/nodes/<type>/__tests__/`:
- Generator output correctness for each export target
- Default data factory
- Edge cases (empty fields, special characters in names)

Check if existing tests in `src/lib/__tests__/` or `src/store/__tests__/` need updates.

## Common Patterns to Follow

### Node Colors
Define in `constants.ts`. Use the hex format matching existing nodes. The color appears in the node renderer and optionally in the palette.

### Handle Positions
- Input handles: top or left
- Output handles: bottom or right
- Branching nodes (if-else, switch): multiple named output handles
- Study `src/components/nodes/base-node.tsx` for the shared handle rendering

### Form Fields
Use `react-hook-form` with `zodResolver` from `@hookform/resolvers/zod/v4`. Follow the existing cast pattern for `zodResolver` typing — do not simplify it without verifying TypeScript behavior.

### Name Sanitization
Use existing sanitization helpers from `src/lib/utils.ts` for generated file names. Do not duplicate naming logic.

## Modification Checklist

When modifying an existing node, verify:
- [ ] Type definition updated if data shape changed
- [ ] Default data factory updated with new fields
- [ ] Fields component renders new/changed properties
- [ ] Generator produces correct output with new data
- [ ] Node renderer reflects visual changes
- [ ] Properties panel still works
- [ ] Existing tests pass
- [ ] New tests added for new behavior
- [ ] No regression in other export targets
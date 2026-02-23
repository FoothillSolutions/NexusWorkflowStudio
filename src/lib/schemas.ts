import { z } from "zod/v4";

// ── Shared field ─────────────────────────────────────────────────────────────
const nameField = z
  .string()
  .min(1, "Name is required")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Only alphanumeric characters, hyphens, and underscores"
  );

// ── Per-node-type schemas (used in properties panel forms) ──────────────────

export const startSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
});

export const promptSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
  promptText: z.string(),
  detectedVariables: z.array(z.string()).optional().default([]),
});

export const subAgentSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
  agentName: z.string(),
  taskText: z.string(),
});

export const subAgentFlowSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
  flowRef: z.string(),
  nodeCount: z.coerce.number().int().min(0),
});

export const skillSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
  skillName: z.string(),
  projectName: z.string(),
});

export const mcpToolSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
  toolName: z.string(),
  paramsText: z.string(),
});

export const ifElseSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
  expression: z.string(),
});

export const switchSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
  switchExpr: z.string(),
  cases: z.array(z.string()),
});

export const askUserSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
  questionText: z.string(),
  options: z.array(z.string().min(1, "Option text required")),
});

export const endSchema = z.object({
  name: nameField,
  label: z.string().min(1, "Label is required"),
});

// ── Schema map by node type ─────────────────────────────────────────────────
export const nodeSchemaMap = {
  start: startSchema,
  prompt: promptSchema,
  "sub-agent": subAgentSchema,
  "sub-agent-flow": subAgentFlowSchema,
  skill: skillSchema,
  "mcp-tool": mcpToolSchema,
  "if-else": ifElseSchema,
  switch: switchSchema,
  "ask-user": askUserSchema,
  end: endSchema,
} as const;

// ── Workflow JSON validation schema (for imports) ───────────────────────────
const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

const nodeDataSchema = z.object({
  type: z.string(),
  label: z.string(),
}).passthrough();

const nodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: nodeDataSchema,
}).passthrough();

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
}).passthrough();

export const workflowJsonSchema = z.object({
  name: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  ui: z.object({
    sidebarOpen: z.boolean(),
    minimapVisible: z.boolean(),
    viewport: viewportSchema,
  }),
});

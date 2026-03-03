import { z } from "zod/v4";

const viewportSchema = z.object({ x: z.number(), y: z.number(), zoom: z.number() });
const nodeDataSchema = z.object({ type: z.string(), label: z.string() }).passthrough();
const nodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: nodeDataSchema,
}).passthrough();
const edgeSchema = z.object({ id: z.string(), source: z.string(), target: z.string() }).passthrough();

/** Schema for validating imported/loaded workflow JSON files. */
export const workflowJsonSchema = z.object({
  name: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  ui: z.object({
    sidebarOpen: z.boolean(),
    minimapVisible: z.boolean(),
    viewport: viewportSchema,
    canvasMode: z.string().optional(),
    edgeStyle: z.string().optional(),
  }),
});


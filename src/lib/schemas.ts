/**
 * @deprecated Import from individual node modules or "@/lib/node-registry" instead.
 * This file is kept for backward compatibility only.
 */
export { startSchema }        from "@/nodes/start/constants";
export { endSchema }          from "@/nodes/end/constants";
export { promptSchema }       from "@/nodes/prompt/constants";
export { subAgentSchema }     from "@/nodes/sub-agent/constants";
export { subAgentFlowSchema } from "@/nodes/sub-agent-flow/constants";
export { skillSchema }        from "@/nodes/skill/constants";
export { mcpToolSchema }      from "@/nodes/mcp-tool/constants";
export { ifElseSchema }       from "@/nodes/if-else/constants";
export { switchSchema }       from "@/nodes/switch/constants";
export { askUserSchema }      from "@/nodes/ask-user/constants";
export { nodeSchemaMap }      from "./node-registry";
// Workflow JSON import schema (unchanged, lives here)
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
export const workflowJsonSchema = z.object({
  name: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  ui: z.object({ sidebarOpen: z.boolean(), minimapVisible: z.boolean(), viewport: viewportSchema }),
});
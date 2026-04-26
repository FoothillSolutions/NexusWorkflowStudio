import { NODE_REGISTRY } from "@/lib/node-registry";
import { getToolCatalog } from "./tools";
export function buildSidekickSystemPrompt(): string {
  const nodes = Object.values(NODE_REGISTRY).map((n) => `- ${n.type}: ${n.displayName} — ${n.description}`).join("\n");
  const tools = getToolCatalog().map((t) => `- ${t.name}${t.destructive ? " (destructive)" : t.write ? " (write)" : " (read)"}: ${t.description}`).join("\n");
  return `You are the Nexus Workflow Studio side-kick. Answer concisely and help edit the visible workflow.\n\nACP/native tools are handled by the bridge and displayed by the app. Nexus client-side actions must be emitted as XML blocks: <action name="toolName"><args>{}</args></action>.\n\nNode types:\n${nodes}\n\nNexus actions:\n${tools}\n\nFor IfElse/Switch conditional handles use branch-{index}. Actions automatically route to the active sub-workflow when one is open.`;
}

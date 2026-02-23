/**
 * mermaid-utils.ts
 * Shared Mermaid helper functions used across node generator modules.
 */

/** Convert a node id into a safe Mermaid node identifier */
export function mermaidId(nodeId: string): string {
  return nodeId.replace(/[^a-zA-Z0-9]/g, "_");
}

/** Escape quotes for use in Mermaid labels */
export function mermaidLabel(text: string): string {
  return text.replace(/"/g, "'");
}


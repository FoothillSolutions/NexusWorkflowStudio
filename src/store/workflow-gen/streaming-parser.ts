// ─── Streaming JSON Parser ───────────────────────────────────────────────────
// Incrementally extracts workflow data (nodes, edges, name) from a partial
// JSON stream. Instead of trying to "repair" incomplete JSON, we extract
// individual complete JSON objects from the "nodes" and "edges" arrays
// as they stream in. Each node/edge appears the moment its closing `}` arrives.

import type { StreamParseResult } from "./types";

/**
 * Extract the workflow name from a partial JSON stream.
 * Looks for `"name": "..."` near the start, before the "nodes" array.
 */
function extractName(text: string): string | undefined {
  // Only search in the portion before "nodes" to avoid matching node "name" fields
  const nodesIdx = text.indexOf('"nodes"');
  const searchArea = nodesIdx > 0 ? text.slice(0, nodesIdx) : text.slice(0, 200);
  const m = searchArea.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : undefined;
}

/**
 * Find the start of a top-level array value for a given key.
 * Returns the index of the `[` character, or -1 if not found.
 * "Top-level" means inside the outermost `{` only (depth 1).
 */
function findArrayStart(text: string, key: string): number {
  const pattern = `"${key}"`;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') {
      // Before toggling string state, check if this is our key at the right depth
      if (!inStr && braceDepth === 1 && bracketDepth === 0 && text.startsWith(pattern, i)) {
        // Found the key — skip past it and find the `[`
        let j = i + pattern.length;
        while (j < text.length && /\s|:/.test(text[j])) j++;
        if (j < text.length && text[j] === '[') return j;
      }
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
    if (ch === '[') bracketDepth++;
    if (ch === ']') bracketDepth--;
  }
  return -1;
}

/**
 * Given text starting from `[`, extract all complete top-level objects
 * (depth 1 inside the array = complete `{…}` blocks). Returns the
 * parsed objects and the index up to which we've consumed.
 */
function extractCompleteObjects(text: string, arrayStart: number): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  let i = arrayStart + 1; // skip the `[`
  let inStr = false;
  let esc = false;
  let depth = 0;
  let objStart = -1;

  while (i < text.length) {
    const ch = text[i];
    if (esc) { esc = false; i++; continue; }
    if (ch === '\\' && inStr) { esc = true; i++; continue; }
    if (ch === '"') { inStr = !inStr; i++; continue; }
    if (inStr) { i++; continue; }

    // End of the array
    if (ch === ']' && depth === 0) break;

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const objStr = text.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(objStr);
          results.push(obj);
        } catch {
          // Malformed object — skip it
        }
        objStart = -1;
      }
    }
    i++;
  }
  return results;
}

/**
 * Incrementally extract workflow data from a partial JSON stream.
 * Never fails — simply returns whatever complete nodes/edges have been
 * streamed so far.
 */
export function extractStreamedWorkflow(text: string): StreamParseResult {
  const name = extractName(text);

  const nodesStart = findArrayStart(text, "nodes");
  const nodes = nodesStart >= 0 ? extractCompleteObjects(text, nodesStart) : [];

  const edgesStart = findArrayStart(text, "edges");
  const edges = edgesStart >= 0 ? extractCompleteObjects(text, edgesStart) : [];

  return { name, nodes, edges };
}

/**
 * Attempt to parse the complete JSON (for final validation).
 * Returns null if the JSON is not yet complete.
 */
export function tryParseCompleteJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}


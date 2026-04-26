import type { ParsedActionCall } from "./types";

export interface ParserChunkResult { calls: ParsedActionCall[]; displayText: string }
let seq = 0;
function id() { seq += 1; return `action_${seq}`; }
function stripFenced(text: string): string {
  let out = ""; let inFence = false;
  for (const line of text.split(/(\n)/)) {
    if (line.startsWith("```")) { inFence = !inFence; continue; }
    if (!inFence) out += line;
  }
  return out;
}
export class StreamingActionParser {
  private buffer = "";
  push(chunk: string): ParserChunkResult {
    this.buffer += chunk;
    const calls: ParsedActionCall[] = [];
    const searchable = stripFenced(this.buffer);
    let consumedTo = 0;
    while (true) {
      const start = searchable.indexOf("<action", consumedTo);
      if (start < 0) break;
      const end = searchable.indexOf("</action>", start);
      if (end < 0) break;
      const raw = searchable.slice(start, end + "</action>".length);
      const name = raw.match(/<action\s+[^>]*name=["']([^"']+)["'][^>]*>/)?.[1] ?? "";
      const argsRaw = raw.match(/<args>([\s\S]*?)<\/args>/)?.[1]?.trim() ?? "{}";
      try { calls.push({ id: id(), name, args: JSON.parse(argsRaw), raw }); }
      catch (error) { calls.push({ id: id(), name, args: {}, raw, error: error instanceof Error ? error.message : "Malformed JSON" }); }
      consumedTo = end + "</action>".length;
    }
    if (consumedTo > 0) this.buffer = searchable.slice(consumedTo);
    return { calls, displayText: chunk };
  }
  flush(): ParserChunkResult { const text = this.buffer; this.buffer = ""; return { calls: [], displayText: text }; }
}
export function parseActionsFromText(text: string): ParsedActionCall[] { const p = new StreamingActionParser(); return p.push(text).calls; }

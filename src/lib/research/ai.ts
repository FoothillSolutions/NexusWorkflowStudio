import { ResearchEnrichmentResultSchema } from "./schemas";
import { detectResearchContentType } from "./detect-content-type";
import type { ResearchBlock, ResearchEnrichmentResult, ResearchSynthesis } from "./types";

export class ResearchAiError extends Error {}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw;
}

function clampConfidence(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

export function coerceLooseEnrichResult(value: unknown, fallbackText = ""): ResearchEnrichmentResult {
  const obj = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const contentType = typeof obj.contentType === "string" ? obj.contentType : detectResearchContentType(fallbackText);
  const coerced = {
    contentType,
    category: typeof obj.category === "string" ? obj.category : "General",
    annotation: typeof obj.annotation === "string" ? obj.annotation : "AI annotation unavailable.",
    confidence: clampConfidence(obj.confidence),
    influencedByIndices: Array.isArray(obj.influencedByIndices)
      ? obj.influencedByIndices.map(Number).filter(Number.isInteger)
      : [],
    isUnrelated: Boolean(obj.isUnrelated),
    mergeWithIndex: obj.mergeWithIndex === null || obj.mergeWithIndex === undefined ? null : Number(obj.mergeWithIndex),
    sources: Array.isArray(obj.sources) ? obj.sources : [],
  };
  const parsed = ResearchEnrichmentResultSchema.safeParse(coerced);
  if (!parsed.success) throw new ResearchAiError("Invalid enrichment result");
  return parsed.data;
}

export function parseEnrichResult(raw: string, fallbackText = ""): ResearchEnrichmentResult {
  try {
    return coerceLooseEnrichResult(JSON.parse(extractJson(raw)), fallbackText);
  } catch (error) {
    if (error instanceof ResearchAiError) throw error;
    throw new ResearchAiError("Invalid AI JSON response");
  }
}

export function buildEnrichmentPrompt(block: ResearchBlock, allBlocks: ResearchBlock[]): string {
  return [
    "Enrich this research note for Nexus Research.",
    "Return JSON only with contentType, category, annotation, confidence, influencedByIndices, isUnrelated, mergeWithIndex, optional sources.",
    `Note: ${block.content}`,
    "Existing notes:",
    ...allBlocks.map((item, index) => `${index}: ${item.content}`),
  ].join("\n");
}

export async function enrichResearchBlock(
  block: ResearchBlock,
  allBlocks: ResearchBlock[],
  callConnector?: (prompt: string) => Promise<string>,
): Promise<ResearchEnrichmentResult> {
  if (!callConnector) throw new ResearchAiError("AI not connected");
  const result = parseEnrichResult(await callConnector(buildEnrichmentPrompt(block, allBlocks)), block.content);
  return {
    ...result,
    influencedByBlockIds: result.influencedByIndices.map((index) => allBlocks[index]?.id).filter(Boolean),
    mergeWithBlockId: result.mergeWithIndex === null ? null : allBlocks[result.mergeWithIndex]?.id ?? null,
  };
}

export function synthesizeResearch(blocks: ResearchBlock[], title = "Research Synthesis", createdBy = "research"): ResearchSynthesis {
  const now = new Date().toISOString();
  const lines = blocks.length
    ? blocks.map((block) => `- **${block.category || block.contentType}**: ${block.content}${block.annotation ? ` — ${block.annotation}` : ""}`)
    : ["No notes selected for synthesis."];
  return {
    id: `syn-${Date.now().toString(36)}`,
    title,
    content: [`# ${title}`, "", ...lines].join("\n"),
    sourceBlockIds: blocks.map((block) => block.id),
    createdAt: now,
    createdBy,
  };
}

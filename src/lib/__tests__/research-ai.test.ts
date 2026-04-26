import { describe, expect, test } from "bun:test";
import { enrichResearchBlock, parseEnrichResult, ResearchAiError } from "@/lib/research/ai";
import type { ResearchBlock } from "@/lib/research/types";

const now = new Date().toISOString();
const block: ResearchBlock = { id: "b1", content: "https://example.com source", contentType: "note", category: "General", annotation: "", confidence: 0, influencedByBlockIds: [], isUnrelated: false, mergeWithBlockId: null, sources: [], tasks: [], pinned: false, collapsed: false, createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "" };

describe("research ai", () => {
  test("parses fenced JSON and clamps confidence", () => {
    const result = parseEnrichResult("```json\n{\"contentType\":\"claim\",\"category\":\"C\",\"annotation\":\"A\",\"confidence\":2,\"influencedByIndices\":[0],\"isUnrelated\":false,\"mergeWithIndex\":null}\n```", "note");
    expect(result.contentType).toBe("claim");
    expect(result.confidence).toBe(1);
  });

  test("reports invalid JSON and unavailable connector", async () => {
    expect(() => parseEnrichResult("not json", "note")).toThrow(ResearchAiError);
    await expect(enrichResearchBlock(block, [block])).rejects.toThrow("AI not connected");
  });
});

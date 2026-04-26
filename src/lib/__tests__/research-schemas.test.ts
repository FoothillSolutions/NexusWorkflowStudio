import { describe, expect, test } from "bun:test";
import { CreateResearchSpaceSchema, PromoteResearchSchema, ResearchBlockSchema, SaveResearchSpaceSchema } from "@/lib/research/schemas";

const now = new Date().toISOString();

describe("research schemas", () => {
  test("validates blocks, templates, saves, and promotion payloads", () => {
    const block = ResearchBlockSchema.parse({ id: "b1", content: "Why?", createdAt: now, updatedAt: now });
    expect(block.contentType).toBe("note");
    expect(CreateResearchSpaceSchema.parse({ name: "PRD", templateId: "prd" }).templateId).toBe("prd");
    expect(SaveResearchSpaceSchema.safeParse({ data: { id: "s", workspaceId: "w", name: "S", createdAt: now, updatedAt: now } }).success).toBe(true);
    expect(PromoteResearchSchema.parse({}).target).toBe("workspace");
  });

  test("rejects invalid template ids", () => {
    expect(CreateResearchSpaceSchema.safeParse({ name: "Bad", templateId: "bad" }).success).toBe(false);
  });
});

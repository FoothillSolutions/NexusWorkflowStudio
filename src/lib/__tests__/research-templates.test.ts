import { describe, expect, test } from "bun:test";
import { RESEARCH_TEMPLATE_IDS, createTemplateBlocks, getResearchTemplateName } from "@/lib/research/templates";

describe("research templates", () => {
  test("all V1 templates have deterministic starter tiles", () => {
    expect(RESEARCH_TEMPLATE_IDS).toEqual(["research-brief", "prd", "implementation-plan", "decision-log"]);
    for (const id of RESEARCH_TEMPLATE_IDS) {
      const blocks = createTemplateBlocks(id, "test");
      expect(getResearchTemplateName(id).length).toBeGreaterThan(0);
      expect(blocks.length).toBeGreaterThanOrEqual(3);
      expect(blocks[0].id).toBe(`${id}-block-1`);
      expect(blocks[0].pinned).toBe(true);
    }
  });
});

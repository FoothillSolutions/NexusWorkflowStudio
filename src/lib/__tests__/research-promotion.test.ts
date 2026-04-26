import { describe, expect, test } from "bun:test";
import { buildResearchPromotionDoc } from "@/lib/research/promotion";
import type { ResearchSpaceData } from "@/lib/research/types";

const now = new Date().toISOString();
const space: ResearchSpaceData = { id: "s", workspaceId: "w", name: "Space", createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "", blocks: [{ id: "b", content: "Selected", contentType: "claim", category: "C", annotation: "A", confidence: 1, influencedByBlockIds: [], isUnrelated: false, mergeWithBlockId: null, sources: [], tasks: [{ id: "t", text: "Task", done: false }], pinned: false, collapsed: false, createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "" }], collapsedIds: [], ghostNotes: [], syntheses: [{ id: "syn", title: "Syn", content: "Synth", sourceBlockIds: ["b"], createdAt: now, createdBy: "" }], templateId: "prd", associatedWorkflowIds: ["wf1"], viewMode: "tiling", selectedBlockIds: ["b"] };

describe("research promotion", () => {
  test("builds workspace and personal Brain inputs", () => {
    const doc = buildResearchPromotionDoc(space, { target: "workspace", blockIds: ["b"] });
    expect(doc.docType).toBe("summary");
    expect(doc.associatedWorkflowIds).toEqual(["wf1"]);
    expect(doc.content).toContain("Template: prd");
    expect(buildResearchPromotionDoc(space, { target: "personal" }).tags).toContain("personal");
  });
});

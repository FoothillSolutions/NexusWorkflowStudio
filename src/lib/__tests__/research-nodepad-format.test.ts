import { describe, expect, test } from "bun:test";
import { parseNodepad, serializeNodepad } from "@/lib/research/nodepad-format";
import type { ResearchSpaceData } from "@/lib/research/types";

const now = new Date().toISOString();
const space: ResearchSpaceData = { id: "s", workspaceId: "w", name: "Space", createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "", blocks: [{ id: "b", content: "Note", contentType: "note", category: "General", annotation: "A", confidence: 0.5, influencedByBlockIds: [], isUnrelated: false, mergeWithBlockId: null, sources: [], tasks: [], pinned: true, collapsed: false, createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "" }], collapsedIds: [], ghostNotes: [], syntheses: [], templateId: null, associatedWorkflowIds: [], viewMode: "tiling", selectedBlockIds: [] };

describe("nodepad format", () => {
  test("round trips .nodepad data", () => {
    const parsed = parseNodepad(serializeNodepad(space), "w2", "s2");
    expect(parsed.id).toBe("s2");
    expect(parsed.workspaceId).toBe("w2");
    expect(parsed.blocks[0].content).toBe("Note");
  });

  test("rejects malformed imports", () => {
    expect(() => parseNodepad("{", "w", "s")).toThrow("Malformed");
  });
});

import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { buildResearchRoomId, decodeResearchSnapshot, encodeResearchSnapshot, isResearchDocEmpty, prepareResearchAutosaveSnapshot, readResearchSpaceFromDoc, writeResearchSpaceToDoc } from "@/lib/research/collaboration";
import type { ResearchSpaceData } from "@/lib/research/types";

const now = new Date().toISOString();
const space: ResearchSpaceData = { id: "s", workspaceId: "w", name: "Space", createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "", blocks: [{ id: "b", content: "Note", contentType: "note", category: "General", annotation: "", confidence: 0, influencedByBlockIds: [], isUnrelated: false, mergeWithBlockId: null, sources: [], tasks: [], pinned: false, collapsed: true, createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "" }], collapsedIds: [], ghostNotes: [], syntheses: [], templateId: null, associatedWorkflowIds: [], viewMode: "tiling", selectedBlockIds: ["b"] };

describe("research collaboration", () => {
  test("uses exact room ids and round-trips Yjs snapshots", () => {
    expect(buildResearchRoomId("w", "s")).toBe("nexus-research-w-s");
    const doc = new Y.Doc();
    expect(isResearchDocEmpty(doc)).toBe(true);
    writeResearchSpaceToDoc(doc, space);
    expect(readResearchSpaceFromDoc(doc, space).blocks[0].id).toBe("b");
    expect(decodeResearchSnapshot(encodeResearchSnapshot(space), space).blocks[0].content).toBe("Note");
    expect(prepareResearchAutosaveSnapshot(space).collapsedIds).toEqual(["b"]);
    expect(prepareResearchAutosaveSnapshot(space).selectedBlockIds).toEqual([]);
  });
});

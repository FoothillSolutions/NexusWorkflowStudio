import { describe, expect, test } from "bun:test";
import { exportResearchMarkdown } from "@/lib/research/markdown-export";
import type { ResearchSpaceData } from "@/lib/research/types";

const now = new Date().toISOString();
const base: ResearchSpaceData = { id: "s", workspaceId: "w", name: "Space", createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "", blocks: [], collapsedIds: [], ghostNotes: [], syntheses: [], templateId: null, associatedWorkflowIds: [], viewMode: "tiling", selectedBlockIds: [] };

describe("research markdown export", () => {
  test("exports empty spaces and grouped content", () => {
    expect(exportResearchMarkdown(base)).toContain("_No research notes yet._");
    const md = exportResearchMarkdown({ ...base, blocks: [{ id: "b", content: "Do x", contentType: "task", category: "Work", annotation: "", confidence: 0, influencedByBlockIds: [], isUnrelated: false, mergeWithBlockId: null, sources: [{ id: "src", title: "A|B", url: "https://x" }], tasks: [{ id: "t", text: "sub", done: false }], pinned: false, collapsed: false, createdAt: now, updatedAt: now, createdBy: "", lastModifiedBy: "" }] });
    expect(md).toContain("## Tasks");
    expect(md).toContain("## Sources");
    expect(md).toContain("A\\|B");
  });
});

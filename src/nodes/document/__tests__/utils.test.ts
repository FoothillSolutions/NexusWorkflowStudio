import { describe, expect, it } from "bun:test";
import { SubAgentMemory, SubAgentModel } from "@/nodes/agent/enums";
import type { WorkflowNode } from "@/types/workflow";
import {
  collectDocumentSubfolders,
  getDocumentDisplayPath,
  getDocumentRelativePath,
  normalizeDocSubfolder,
} from "../utils";

function makeNode(overrides: Partial<WorkflowNode>): WorkflowNode {
  return {
    id: overrides.id ?? "node-1",
    type: overrides.type ?? "document",
    position: overrides.position ?? { x: 0, y: 0 },
    data:
      overrides.data ??
      ({ type: "document", label: "Doc", name: "node-1" } as WorkflowNode["data"]),
    ...overrides,
  } as WorkflowNode;
}

describe("document utils", () => {
  it("normalizes subfolder names to lowercase hyphenated slugs", () => {
    expect(normalizeDocSubfolder(" Team Guides / API ")).toBe("team-guides-api");
    expect(normalizeDocSubfolder("already-clean")).toBe("already-clean");
    expect(normalizeDocSubfolder("---Mixed__Case---")).toBe("mixed-case");
  });

  it("builds relative and display paths with sensible fallbacks", () => {
    expect(
      getDocumentRelativePath({
        docName: "api-guide",
        fileExtension: "md",
        docSubfolder: "guides",
      }),
    ).toBe("guides/api-guide.md");

    expect(
      getDocumentRelativePath({
        docName: "",
        fileExtension: "json",
        docSubfolder: "data",
      }),
    ).toBeNull();

    expect(
      getDocumentDisplayPath({
        docName: "",
        fileExtension: "yaml",
        docSubfolder: "configs",
      }),
    ).toBe("configs/untitled.yaml");

    expect(
      getDocumentDisplayPath({
        docName: "readme",
        fileExtension: "txt",
        docSubfolder: "",
      }),
    ).toBe("readme.txt");
  });

  it("collects, de-duplicates, and sorts document subfolders across nested sub-workflows", () => {
    const nestedDoc = makeNode({
      id: "doc-2",
      data: {
        type: "document",
        label: "Nested Doc",
        name: "doc-2",
        docName: "nested",
        fileExtension: "md",
        docSubfolder: "beta",
      } as WorkflowNode["data"],
    });

    const nestedSubWorkflow = makeNode({
      id: "sub-1",
      type: "sub-workflow",
      data: {
        type: "sub-workflow",
        label: "Nested Workflow",
        name: "sub-1",
        mode: "same-context",
        description: "",
        subNodes: [nestedDoc],
        subEdges: [],
        nodeCount: 1,
        model: SubAgentModel.Inherit,
        memory: SubAgentMemory.Default,
        temperature: 0,
        color: "#000000",
        disabledTools: [],
      } as WorkflowNode["data"],
    });

    const rootNodes: WorkflowNode[] = [
      makeNode({
        id: "doc-1",
        data: {
          type: "document",
          label: "Root Doc",
          name: "doc-1",
          docName: "guide",
          fileExtension: "md",
          docSubfolder: "alpha",
        } as WorkflowNode["data"],
      }),
      makeNode({
        id: "doc-3",
        data: {
          type: "document",
          label: "Another Root Doc",
          name: "doc-3",
          docName: "guide-two",
          fileExtension: "md",
          docSubfolder: "alpha",
        } as WorkflowNode["data"],
      }),
      nestedSubWorkflow,
    ];

    expect(collectDocumentSubfolders(rootNodes)).toEqual(["alpha", "beta"]);
  });
});



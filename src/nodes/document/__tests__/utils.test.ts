import { describe, expect, it } from "bun:test";
import type { WorkflowNode } from "@/types/workflow";
import {
  makeSubWorkflowNode,
  makeWorkflowNode,
} from "@/test-support/workflow-fixtures";
import {
  collectDocumentSubfolders,
  getDocumentDisplayPath,
  getDocumentRelativePath,
  normalizeDocSubfolder,
} from "../utils";

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
    const nestedDoc = makeWorkflowNode({
      id: "doc-2",
      type: "document",
      data: {
        type: "document",
        label: "Nested Doc",
        name: "doc-2",
        docName: "nested",
        fileExtension: "md",
        docSubfolder: "beta",
      } as WorkflowNode["data"],
    });

    const nestedSubWorkflow = makeSubWorkflowNode("sub-1", [nestedDoc]);

    const rootNodes: WorkflowNode[] = [
      makeWorkflowNode({
        id: "doc-1",
        type: "document",
        data: {
          type: "document",
          label: "Root Doc",
          name: "doc-1",
          docName: "guide",
          fileExtension: "md",
          docSubfolder: "alpha",
        } as WorkflowNode["data"],
      }),
      makeWorkflowNode({
        id: "doc-3",
        type: "document",
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



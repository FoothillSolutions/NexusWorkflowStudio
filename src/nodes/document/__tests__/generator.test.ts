import { describe, expect, it } from "bun:test";
import { WorkflowNodeType } from "@/types/workflow";
import { generator } from "../generator";

describe("document generator", () => {
  it("renders nullable linked file metadata safely in details output", () => {
    const details = generator.getDetailsSection("doc-1", {
      type: WorkflowNodeType.Document,
      label: "API Guide",
      name: "doc-1",
      docName: "api-guide",
      docSubfolder: "guides",
      contentMode: "linked",
      fileExtension: "md",
      contentText: "",
      linkedFileName: null,
      linkedFileContent: null,
      description: "Reference guide",
    });

    expect(details).toContain("linked (none)");
    expect(details).toContain("docs/guides/api-guide.md");
  });

  it("generates document file content from linked uploads when present", () => {
    const file = generator.getDocFile?.("doc-2", {
      type: WorkflowNodeType.Document,
      label: "Schema",
      name: "doc-2",
      docName: "schema",
      docSubfolder: "data",
      contentMode: "linked",
      fileExtension: "json",
      contentText: "",
      linkedFileName: "schema.json",
      linkedFileContent: '{"ok":true}',
      description: "JSON schema",
    });

    expect(file).not.toBeNull();
    expect(file?.content).toBe('{"ok":true}\n');
  });
});


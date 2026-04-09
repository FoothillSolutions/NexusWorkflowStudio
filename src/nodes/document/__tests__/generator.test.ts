import { describe, expect, it } from "bun:test";
import { WorkflowNodeType } from "@/types/workflow";
import type { DocumentNodeData } from "../types";
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
      brainDocId: null,
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
      brainDocId: null,
    });

    expect(file).not.toBeNull();
    expect(file?.content).toBe('{"ok":true}\n');
  });

  it("generates doc file from brain mode using contentText", () => {
    const data: DocumentNodeData = {
      type: WorkflowNodeType.Document,
      label: "API Guide",
      name: "node-1",
      docName: "api-guide",
      docSubfolder: "",
      contentMode: "brain",
      fileExtension: "md",
      contentText: "# API Guide\n\nContent from brain.",
      linkedFileName: null,
      linkedFileContent: null,
      description: "API documentation from brain",
      brainDocId: "abc123xyz",
    };

    const result = generator.getDocFile?.("node-1", data, "opencode");
    expect(result).not.toBeNull();
    expect(result?.path).toBe(".opencode/docs/api-guide.md");
    expect(result?.content).toContain("# API Guide");
  });
});


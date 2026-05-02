import { describe, expect, it } from "bun:test";

import { getDirectoryExportDestinationLabel } from "@/lib/generated-workflow-export";

describe("generated-workflow-export helpers", () => {
  it("plans Claude direct folder export into the plugin root unless already selected", () => {
    expect(getDirectoryExportDestinationLabel("Downloads", { name: "Review PR" }, "claude-code")).toBe(
      "Downloads/nexus-review-pr",
    );
    expect(getDirectoryExportDestinationLabel("nexus-review-pr", { name: "Review PR" }, "claude-code")).toBe(
      "nexus-review-pr",
    );
  });

  it("keeps OpenCode and PI direct folder labels rooted in dot folders", () => {
    expect(getDirectoryExportDestinationLabel("repo", { name: "Review PR" }, "opencode")).toBe(
      "repo/.opencode",
    );
    expect(getDirectoryExportDestinationLabel(".pi", { name: "Review PR" }, "pi")).toBe(".pi");
  });
});

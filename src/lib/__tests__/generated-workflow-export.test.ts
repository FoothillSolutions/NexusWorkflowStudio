import { describe, expect, it } from "bun:test";

import { getGeneratedWorkflowBundleName } from "../generated-workflow-export";
import type { WorkflowJSON } from "@/types/workflow";

const workflow: WorkflowJSON = {
  name: "Customer Setup!",
  nodes: [],
  edges: [],
  ui: {
    sidebarOpen: true,
    minimapVisible: false,
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

describe("generated-workflow-export", () => {
  it("names exports as isolated bundles instead of target root folders", () => {
    expect(getGeneratedWorkflowBundleName(workflow, "opencode")).toBe(
      "customer-setup-opencode-export",
    );
    expect(getGeneratedWorkflowBundleName(workflow, "claude-code")).toBe(
      "customer-setup-claude-code-export",
    );
  });
});

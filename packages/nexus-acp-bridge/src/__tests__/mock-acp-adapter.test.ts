import { describe, expect, test } from "bun:test";
import { MockACPAdapter, __private__ } from "../mock-acp-adapter";
import { makeBridgeConfig } from "./test-helpers";

const config = makeBridgeConfig();

describe("MockACPAdapter", () => {
  test("returns OpenCode-compatible provider metadata", async () => {
    const adapter = new MockACPAdapter(config);
    const providers = await adapter.getConfigProviders();

    expect(providers.providers).toHaveLength(1);
    expect(providers.providers[0]?.models.model?.status).toBe("active");
    expect(providers.default.acp).toBe("model");
  });

  test("emits parseable workflow JSON for workflow generation prompts", () => {
    const output = __private__.buildWorkflowResponse(
      "Output a WorkflowJSON object for this workflow. Workflow description: triage customer issues",
    );
    const parsed = JSON.parse(output) as { name: string; nodes: unknown[]; edges: unknown[] };

    expect(parsed.name).toContain("Triage customer issues");
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);
  });

  test("emits parseable example arrays", () => {
    const output = __private__.buildExamplesResponse();
    const parsed = JSON.parse(output) as string[];

    expect(parsed).toHaveLength(5);
    expect(parsed.every((item) => item.length > 0)).toBe(true);
  });

  test("exposes a default project resource", async () => {
    const adapter = new MockACPAdapter(config);
    const resources = await adapter.listResources({
      project: {
        id: "project-1",
        worktree: process.cwd(),
        name: "Nexus",
        time: { created: Date.now(), updated: Date.now() },
        sandboxes: [],
      },
    });

    expect(resources.project?.uri).toContain("file://");
  });
});



import { describe, expect, it } from "bun:test";
import {
  buildConnectedNodeContextBlock,
  buildConnectedResourcesBlock,
  buildEditUserMessage,
  buildGenerateUserMessage,
  buildSystemMessage,
  estimateTokens,
  extractTextFromParts,
  formatNodeSummary,
} from "../../prompt-gen";
import type { ConnectedNodeContext, NodeSummary } from "@/nodes/shared/use-connected-resources";

describe("prompt-gen-helpers", () => {
  it("builds connected resource blocks with skills, docs, and scripts", () => {
    const block = buildConnectedResourcesBlock({
      skills: ["lint-fix"],
      docs: ["api-guide.md"],
      scripts: ["normalize-data"],
    });

    expect(block).toContain("**Connected Skills:**");
    expect(block).toContain("- {{lint-fix}}");
    expect(block).toContain("**Connected Documents:**");
    expect(block).toContain("- {{api-guide.md}}");
    expect(block).toContain("**Connected Scripts:**");
    expect(block).toContain("- {{normalize-data}}");
  });

  it("formats a node summary with description, prompt excerpt, and branches", () => {
    const summary: NodeSummary = {
      id: "if-1",
      type: "if-else",
      label: "Check status",
      name: "if-1",
      description: "Branches by API status",
      promptText: "Inspect the status field and route accordingly.",
      branches: ["status === ok", "status !== ok"],
    };

    const formatted = formatNodeSummary(summary);
    expect(formatted).toContain('**[if-else]** "Check status"');
    expect(formatted).toContain("Branches by API status");
    expect(formatted).toContain("Prompt excerpt: Inspect the status field");
    expect(formatted).toContain("Branches: status === ok; status !== ok");
  });

  it("builds workflow context blocks from upstream and downstream nodes", () => {
    const context: ConnectedNodeContext = {
      upstream: [
        {
          id: "prompt-1",
          type: "prompt",
          label: "Prepare data",
          name: "prompt-1",
        },
      ],
      downstream: [
        {
          id: "agent-2",
          type: "agent",
          label: "Review",
          name: "agent-2",
        },
      ],
    };

    const block = buildConnectedNodeContextBlock(context);
    expect(block).toContain("**Upstream Nodes (execute before this node):**");
    expect(block).toContain("Prepare data");
    expect(block).toContain("**Downstream Nodes (execute after this node):**");
    expect(block).toContain("Review");
  });

  it("builds a skill generation message that includes resources and workflow context", () => {
    const message = buildGenerateUserMessage({
      mode: "freeform",
      freeformDescription: "Teach the agent how to validate CSV imports.",
      nodeType: "skill",
      modelId: "claude-sonnet-4.5",
      providerId: "github-copilot",
      fields: {
        instructions: "Validate headers, detect malformed rows, and summarize issues.",
      },
      connectedResourceNames: {
        skills: [],
        docs: [],
        scripts: ["csv-validator"],
      },
      connectedNodeContext: {
        upstream: [
          {
            id: "doc-1",
            type: "document",
            label: "Import Spec",
            name: "import-spec",
          },
        ],
        downstream: [],
      },
    });

    expect(message).toContain("Write the skill prompt text for a skill described as:");
    expect(message).toContain("## Instructions");
    expect(message).toContain("## Connected Resources");
    expect(message).toContain("{{csv-validator}}");
    expect(message).toContain("## Resource Guidance");
    expect(message).toContain("## Workflow Context");
    expect(message).toContain("Import Spec");
  });

  it("builds an edit message that preserves context for prompt nodes", () => {
    const message = buildEditUserMessage({
      currentPrompt: "Summarize the release notes.",
      editInstruction: "Make it stricter about including breaking changes.",
      modelId: "claude-sonnet-4.5",
      providerId: "github-copilot",
      nodeType: "prompt",
      connectedResourceNames: {
        skills: ["release-audit"],
        docs: ["changelog.md"],
        scripts: [],
      },
      connectedNodeContext: {
        upstream: [],
        downstream: [
          {
            id: "agent-9",
            type: "agent",
            label: "Publish release",
            name: "publish-release",
          },
        ],
      },
    });

    expect(message).toContain("Here is the current prompt:");
    expect(message).toContain("Make it stricter about including breaking changes.");
    expect(message).toContain("{{release-audit}}");
    expect(message).toContain("{{changelog.md}}");
    expect(message).toContain("Publish release");
    expect(message).toContain("Output ONLY the modified prompt text");
  });

  it("returns node-type-specific system messages", () => {
    expect(buildSystemMessage("script")).toContain("Bun script generator");
    expect(buildSystemMessage("skill")).toContain("skill-prompt generator");
    expect(buildSystemMessage("prompt")).toContain("prompt-text generator");
    expect(buildSystemMessage("agent")).toContain("THE PROMPT that the agent will receive");
  });

  it("extracts text parts and estimates tokens", () => {
    const text = extractTextFromParts([
      { type: "text", text: "Hello" },
      { type: "step-start" } as never,
      { type: "text", text: " world" },
    ] as never);

    expect(text).toBe("Hello world");
    expect(estimateTokens("12345678")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });
});




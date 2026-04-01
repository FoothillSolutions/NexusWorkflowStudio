import { describe, expect, it } from "bun:test";
import { WorkflowNodeType } from "@/types/workflow";
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
      nodeType: WorkflowNodeType.Skill,
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
      nodeType: WorkflowNodeType.Prompt,
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
    expect(buildSystemMessage(WorkflowNodeType.Script)).toContain("Bun script generator");
    expect(buildSystemMessage(WorkflowNodeType.Skill)).toContain("skill-prompt generator");
    expect(buildSystemMessage(WorkflowNodeType.Prompt)).toContain("prompt-text generator");
    expect(buildSystemMessage(WorkflowNodeType.Agent)).toContain("agent-file prompt generator");
    expect(buildSystemMessage(WorkflowNodeType.Agent)).toContain("agent file content itself");
    expect(buildSystemMessage(WorkflowNodeType.Agent)).toContain("Do NOT include device-specific commands");
  });

  it("keeps generated agent prompts limited to agent file content and platform-neutral guidance", () => {
    const message = buildGenerateUserMessage({
      mode: "freeform",
      freeformDescription: "Create an agent that reviews pull requests and summarizes risks.",
      nodeType: WorkflowNodeType.Agent,
      modelId: "claude-sonnet-4.5",
      providerId: "github-copilot",
      fields: {
        instructions: "Review changed files, highlight regressions, and summarize follow-up work.",
      },
      connectedResourceNames: {
        skills: ["security-review"],
        docs: ["review-checklist.md"],
        scripts: [],
      },
      connectedNodeContext: {
        upstream: [],
        downstream: [],
      },
    });

    expect(message).toContain("Write only the Markdown body content for the agent file");
    expect(message).toContain("output ONLY the agent file content itself");
    expect(message).toContain("no device-specific commands or settings");
    expect(message).toContain("{{security-review}}");
    expect(message).toContain("{{review-checklist.md}}");
  });

  it("keeps edited agent prompts limited to agent file content and avoids device-specific settings", () => {
    const message = buildEditUserMessage({
      currentPrompt: "You are a careful code review agent.",
      editInstruction: "Make the review stricter about security-sensitive file changes.",
      modelId: "claude-sonnet-4.5",
      providerId: "github-copilot",
      nodeType: WorkflowNodeType.Agent,
      connectedResourceNames: {
        skills: [],
        docs: [],
        scripts: [],
      },
      connectedNodeContext: {
        upstream: [],
        downstream: [],
      },
    });

    expect(message).toContain("Output ONLY the modified agent file content itself");
    expect(message).toContain("no wrapper text, and no device-specific commands/settings unless explicitly required by the edit instruction");
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




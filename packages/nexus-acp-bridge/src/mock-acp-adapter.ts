import {
  buildDefaultConfigProviders,
  buildDefaultMcpStatus,
  buildDefaultResources,
  buildDefaultTools,
} from "./default-provider";
import type {
  ACPAdapter,
  BridgeConfig,
  Command,
  ConfigProviders,
  GenerateTextRequest,
  HealthInfo,
  MCPStatus,
  McpResource,
  Project,
  ToolListItem,
} from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "workflow";
}

function extractDescription(prompt: string): string {
  const match = prompt.match(/workflow description:\s*([\s\S]+)$/i);
  return match?.[1]?.trim() ?? prompt.trim();
}

function sentenceCase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "Generated Workflow";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function buildWorkflowResponse(prompt: string): string {
  const description = extractDescription(prompt);
  const title = sentenceCase(description.split(/[\n.]/)[0] ?? "Generated Workflow");
  const baseSlug = slugify(title);

  return JSON.stringify({
    name: title,
    nodes: [
      {
        id: `${baseSlug}-start`,
        type: "start",
        position: { x: 0, y: 0 },
        data: { type: "start", label: "Start", name: "Start" },
      },
      {
        id: `${baseSlug}-agent`,
        type: "agent",
        position: { x: 280, y: 0 },
        data: {
          type: "agent",
          label: "Agent",
          name: `${title} Agent`,
          promptText: `Handle the workflow request: ${description}`,
        },
      },
      {
        id: `${baseSlug}-end`,
        type: "end",
        position: { x: 560, y: 0 },
        data: { type: "end", label: "End", name: "End" },
      },
    ],
    edges: [
      { id: `${baseSlug}-e1`, source: `${baseSlug}-start`, target: `${baseSlug}-agent` },
      { id: `${baseSlug}-e2`, source: `${baseSlug}-agent`, target: `${baseSlug}-end` },
    ],
    ui: {
      sidebarOpen: false,
      minimapVisible: true,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  });
}

function buildExamplesResponse(): string {
  return JSON.stringify([
    "Triage inbound customer support issues and route them by severity",
    "Review a pull request, summarize risks, and request human approval when needed",
    "Turn meeting notes into a prioritized implementation workflow with owners",
    "Analyze bug reports, gather code context, and draft a remediation plan",
    "Process research documents and generate a stakeholder-ready summary pack",
  ]);
}

function buildPromptResponse(prompt: string, system?: string): string {
  const description = extractDescription(prompt);
  if (system?.includes("script generator")) {
    return [
      'export async function main() {',
      `  console.log(${JSON.stringify(`Generated helper for: ${description}`)});`,
      "}",
      "",
      "if (import.meta.main) {",
      "  await main();",
      "}",
    ].join("\n");
  }

  return [
    `# ${sentenceCase(description.split(/[\n.]/)[0] ?? "Generated Prompt")}`,
    "",
    "## Purpose",
    `- ${description}`,
    "",
    "## Instructions",
    "- Review the incoming context carefully.",
    "- Produce a concise, structured response.",
    "- Call out assumptions and edge cases when relevant.",
  ].join("\n");
}

function buildMockCommands(): Command[] {
  return [
    {
      name: "plan",
      description: "Create a detailed implementation plan",
      source: "command",
      template: "/plan {request}",
      hints: ["description of what to plan"],
    },
    {
      name: "test",
      description: "Run or suggest relevant tests for the current project",
      source: "command",
      template: "/test {target}",
      hints: ["what should be tested"],
    },
    {
      name: "web",
      description: "Search the web for supporting information",
      source: "command",
      template: "/web {query}",
      hints: ["query to search for"],
    },
  ];
}

export class MockACPAdapter implements ACPAdapter {
  constructor(private readonly config: BridgeConfig) {}

  async getHealth(): Promise<HealthInfo> {
    return {
      healthy: true,
      version: this.config.version,
    };
  }

  async getConfigProviders(): Promise<ConfigProviders> {
    return buildDefaultConfigProviders(this.config, "acp-mock");
  }

  async listCommands(_input: { project: Project }): Promise<Command[]> {
    return buildMockCommands();
  }

  async listTools(_input: { provider: string; model: string; project: Project }): Promise<ToolListItem[]> {
    return buildDefaultTools(this.config);
  }

  async getMcpStatus(_input: { project: Project }): Promise<Record<string, MCPStatus>> {
    return buildDefaultMcpStatus(this.config);
  }

  async listResources(input: { project: Project }): Promise<Record<string, McpResource>> {
    return buildDefaultResources(
      this.config,
      input.project,
      "Current project root exposed by the mock ACP adapter.",
    );
  }

  async *generateText(request: GenerateTextRequest): AsyncIterable<string> {
    const prompt = request.payload.parts.map((part) => part.text).join("\n\n");
    const system = request.payload.system;

    let output = buildPromptResponse(prompt, system);
    if (/Output a WorkflowJSON object/i.test(prompt)) {
      output = buildWorkflowResponse(prompt);
    } else if (/JSON array/i.test(prompt)) {
      output = buildExamplesResponse();
    }

    const chunkSize = output.startsWith("{") || output.startsWith("[") ? 48 : 64;
    for (let index = 0; index < output.length; index += chunkSize) {
      if (request.signal.aborted) {
        break;
      }
      const chunk = output.slice(index, index + chunkSize);
      yield chunk;
      if (this.config.mockStreamDelayMs > 0) {
        await sleep(this.config.mockStreamDelayMs);
      }
    }
  }
}

export const __private__ = {
  buildWorkflowResponse,
  buildExamplesResponse,
  buildPromptResponse,
  buildMockCommands,
};




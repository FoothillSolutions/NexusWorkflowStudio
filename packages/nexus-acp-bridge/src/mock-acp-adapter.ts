import type {
  ACPAdapter,
  BridgeConfig,
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

export class MockACPAdapter implements ACPAdapter {
  constructor(private readonly config: BridgeConfig) {}

  async getHealth(): Promise<HealthInfo> {
    return {
      healthy: true,
      version: this.config.version,
    };
  }

  async getConfigProviders(): Promise<ConfigProviders> {
    const providerId = this.config.defaultProviderId;
    const modelId = this.config.defaultModelId;

    return {
      providers: [
        {
          id: providerId,
          name: this.config.defaultProviderName,
          source: "api",
          env: [],
          options: {},
          models: {
            [modelId]: {
              id: modelId,
              providerID: providerId,
              api: {
                id: providerId,
                url: "https://example.invalid/acp",
                npm: "nexus-acp-bridge",
              },
              name: this.config.defaultModelName,
              family: "claude",
              capabilities: {
                temperature: true,
                reasoning: true,
                attachment: false,
                toolcall: true,
                input: { text: true, audio: false, image: false, video: false, pdf: false },
                output: { text: true, audio: false, image: false, video: false, pdf: false },
                interleaved: false,
              },
              cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
              limit: { output: 8192, context: 200000 },
              status: "active",
              options: {},
              headers: {},
              release_date: new Date().toISOString(),
            },
          },
        },
      ],
      default: {
        [providerId]: modelId,
      },
    };
  }

  async listTools(_input: { provider: string; model: string; project: Project }): Promise<ToolListItem[]> {
    return this.config.defaultTools.map((tool) => ({
      id: tool,
      description: `Bridge-exposed tool: ${tool}`,
      parameters: { type: "object", properties: {} },
    }));
  }

  async getMcpStatus(_input: { project: Project }): Promise<Record<string, MCPStatus>> {
    return {
      [this.config.defaultProviderId]: { status: "connected" },
    };
  }

  async listResources(input: { project: Project }): Promise<Record<string, McpResource>> {
    return {
      project: {
        name: `${input.project.name ?? "project"} root`,
        uri: `file://${input.project.worktree}`,
        client: this.config.defaultProviderId,
        description: "Current project root exposed by the mock ACP adapter.",
      },
    };
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
};




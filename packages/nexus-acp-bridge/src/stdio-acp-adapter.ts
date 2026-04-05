import { spawn } from "node:child_process";
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

function createConfigProviders(config: BridgeConfig): ConfigProviders {
  const providerId = config.defaultProviderId;
  const modelId = config.defaultModelId;

  return {
    providers: [
      {
        id: providerId,
        name: config.defaultProviderName,
        source: "api",
        env: [],
        options: {},
        models: {
          [modelId]: {
            id: modelId,
            providerID: providerId,
            api: {
              id: providerId,
              url: "https://example.invalid/acp-stdio",
              npm: "nexus-acp-bridge",
            },
            name: config.defaultModelName,
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

function createTools(config: BridgeConfig): ToolListItem[] {
  return config.defaultTools.map((tool) => ({
    id: tool,
    description: `Bridge-exposed tool: ${tool}`,
    parameters: { type: "object", properties: {} },
  }));
}

export class StdioACPAdapter implements ACPAdapter {
  constructor(private readonly config: BridgeConfig) {}

  async getHealth(): Promise<HealthInfo> {
    return {
      healthy: true,
      version: `${this.config.version}-stdio`,
    };
  }

  async getConfigProviders(): Promise<ConfigProviders> {
    return createConfigProviders(this.config);
  }

  async listTools(_input: { provider: string; model: string; project: Project }): Promise<ToolListItem[]> {
    return createTools(this.config);
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
        description: "Current project root exposed by the stdio bridge adapter.",
      },
    };
  }

  async *generateText(request: GenerateTextRequest): AsyncIterable<string> {
    if (!this.config.agentCommand) {
      throw new Error("NEXUS_ACP_BRIDGE_AGENT_COMMAND is required when NEXUS_ACP_BRIDGE_ADAPTER=stdio");
    }

    const cwd = this.config.agentCwd ?? request.project.worktree;
    const child = spawn(this.config.agentCommand, this.config.agentArgs, {
      cwd,
      env: {
        ...process.env,
        NEXUS_ACP_BRIDGE_SESSION_ID: request.session.id,
        NEXUS_ACP_BRIDGE_PROJECT_DIR: request.project.worktree,
        NEXUS_ACP_BRIDGE_PROVIDER_ID: request.payload.model?.providerID ?? this.config.defaultProviderId,
        NEXUS_ACP_BRIDGE_MODEL_ID: request.payload.model?.modelID ?? this.config.defaultModelId,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stderrChunks: string[] = [];
    child.stderr?.on("data", (chunk) => {
      stderrChunks.push(chunk.toString("utf8"));
    });

    const terminate = () => {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    };
    request.signal.addEventListener("abort", terminate, { once: true });

    const exitPromise = new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code ?? 0));
    });

    const envelope = JSON.stringify({
      session: request.session,
      project: request.project,
      payload: request.payload,
    });
    child.stdin?.end(envelope);

    try {
      const stdout = child.stdout;
      if (!stdout) {
        throw new Error("Agent process did not expose stdout");
      }

      for await (const chunk of stdout) {
        if (request.signal.aborted) {
          break;
        }
        yield chunk.toString("utf8");
      }

      const exitCode = await exitPromise;
      if (request.signal.aborted) {
        return;
      }
      if (exitCode !== 0) {
        const stderr = stderrChunks.join("").trim();
        throw new Error(stderr || `Agent process exited with code ${exitCode}`);
      }
    } finally {
      request.signal.removeEventListener("abort", terminate);
    }
  }
}

